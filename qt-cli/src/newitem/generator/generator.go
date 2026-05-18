// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package generator

import (
	"errors"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"qtcli/common/texts"
	"qtcli/common/utils"
	"qtcli/common/validation"
	"qtcli/newitem/preset"
	"regexp"
	"runtime"
	"strings"
	"text/template"

	"github.com/sirupsen/logrus"
)

type Generator struct {
	env        *Env
	name       string
	preset     preset.Preset
	workingDir string
	dryRun     bool
	context    Context
}

type Context struct {
	data            utils.StringAnyMap
	funcs           template.FuncMap
	items           []preset.TemplateItem
	options         preset.TemplateOptions
	outputDirOffset string
}

func NewGenerator(name string) *Generator {
	cwd, _ := os.Getwd()
	cwd = filepath.ToSlash(cwd)

	return &Generator{
		name:       name,
		workingDir: cwd,
		dryRun:     false,
	}
}

func (g *Generator) Env(env *Env) *Generator {
	g.env = env
	return g
}

func (g *Generator) Preset(preset preset.Preset) *Generator {
	g.preset = preset
	return g
}

func (g *Generator) WorkingDir(dir string) *Generator {
	g.workingDir = dir
	return g
}

func (g *Generator) DryRun(on bool) *Generator {
	g.dryRun = on
	return g
}

func (g *Generator) Render() *Result {
	g.name = strings.TrimSpace(g.name)
	g.workingDir = strings.TrimSpace(g.workingDir)

	// input validation
	issues := Validate(ValidatorIn{
		Name:       g.name,
		WorkingDir: g.workingDir,
		TypeId:     g.preset.GetTypeId(),
	})

	if issues.HasError() {
		return NewErrorResult(validation.Error{
			Message: texts.InputHasIssues,
			Details: issues,
		})
	}

	// prep.
	if err := g.prepContext(); err != nil {
		return NewErrorResultFrom(err)
	}

	// expand in, out
	result, err := g.runNames()
	if err != nil {
		return NewErrorResultFrom(err)
	}

	// check if exists
	for _, item := range result.items {
		if !utils.EntryExistsFS(g.env.FS, item.inputFileRel) {
			return NewErrorResultFrom(
				fmt.Errorf("file not found, %s", item.inputFileRel))
		}

		if utils.EntryExists(item.outputFileAbs) {
			return NewErrorResultFrom(
				fmt.Errorf("output already exists, %s", item.outputFileAbs))
		}
	}

	// run contents and save
	for _, item := range result.items {
		if err := g.runContents(item); err != nil {
			return NewErrorResultFrom(err)
		}
	}

	return NewOkayResult(result)
}

func (g *Generator) prepContext() error {
	template, err := g.readTemplateFile()
	if template == nil || err != nil {
		return err
	}

	g.context.data = g.preset.GetOptions()
	g.context.data["name"] = g.name
	g.context.funcs = getApi()
	g.context.items = template.GetFileItems()
	g.context.options = template.GetOptions()
	g.context.outputDirOffset = ""
	if g.preset.GetTypeId() == preset.TargetTypeProject {
		g.context.outputDirOffset = g.name
	}

	err = g.evalFields(template.GetFields())
	if err != nil {
		return err
	}

	return nil
}

func (g *Generator) evalFields(fields []utils.StringAnyMap) error {
	expander := utils.NewTemplateExpander().Funcs(g.context.funcs)

	for _, field := range fields {
		for name, expr := range field {
			exprAsString, ok := expr.(string)
			if !ok {
				g.context.data[name] = expr
				continue
			}

			exprExpanded, err := expander.
				Data(g.context.data).
				RunString(exprAsString)
			if err != nil {
				return err
			}

			g.context.data[name] = strings.TrimSpace(exprExpanded)
		}
	}

	return nil
}

func (g *Generator) runNames() (ResultData, error) {
	result := ResultData{
		workingDir:   g.workingDir,
		outputDirAbs: path.Join(g.workingDir, g.context.outputDirOffset),
	}

	for _, file := range g.context.items {
		okay, err := g.evalWhenCondition(file)
		if err != nil {
			return ResultData{}, err
		}

		if !okay {
			logrus.Debug(
				"skipping generation ",
				"because 'when' condition was not satisfied")
			continue
		}

		inputRel, errIn := g.createInputFileRel(file)
		outputRel, errOut := g.createOutputFileRel(file)
		if errIn != nil || errOut != nil {
			return ResultData{}, err
		}

		result.items = append(result.items, ResultItem{
			templateItem:  file,
			inputFileRel:  inputRel,
			outputFileRel: outputRel,
			outputFileAbs: path.Join(result.outputDirAbs, outputRel),
		})
	}

	return result, nil
}

func (g *Generator) readTemplateFile() (*preset.TemplateFile, error) {
	dir := g.preset.GetTemplateDir()
	filePath := path.Join(dir, g.env.TemplateFileName)

	if len(dir) == 0 {
		return nil, errors.New(utils.Msg("cannot determine a config file path"))
	}

	if !utils.EntryExistsFS(g.env.FS, filePath) {
		return nil, fmt.Errorf(
			utils.Msg("template definition does not exist, dir = '%v'"), dir)
	}

	template, err := preset.OpenTemplateFile(g.env.FS, filePath)
	if err != nil {
		return nil, err
	}

	return template, nil
}

func (g *Generator) runContents(result ResultItem) error {
	// expand input file contents
	allBytes, err := utils.ReadAllFromFS(g.env.FS, result.inputFileRel)

	if err != nil {
		return err
	}

	input := string(allBytes)
	var output string

	if result.templateItem.Bypass {
		output = input
	} else {
		expander := utils.NewTemplateExpander().
			Data(g.context.data).
			Funcs(g.context.funcs)

		output, err = expander.
			Name(result.outputFileAbs).
			AddData("fileName", result.outputFileAbs).
			RunString(input)
	}

	if err != nil {
		return err
	}

	// save to file
	if !g.dryRun {
		output = polishOutput(output, g.context.options.Polish)
		_, err = utils.WriteAll([]byte(output), result.outputFileAbs)
		if err != nil {
			return err
		}
	}

	return nil
}

func (g *Generator) createInputFileRel(file preset.TemplateItem) (string, error) {
	var in string

	if strings.HasPrefix(file.In, "@/") {
		in = file.In[2:]
	} else {
		in = path.Join(g.preset.GetTemplateDir(), file.In)
	}

	expanded, err := utils.NewTemplateExpander().
		Name(file.In).
		Data(g.context.data).
		Funcs(g.context.funcs).
		RunString(in)

	if err != nil {
		return expanded, err
	}

	return expanded, nil
}

func (g *Generator) createOutputFileRel(
	file preset.TemplateItem) (string, error) {
	if len(file.Out) == 0 {
		return path.Base(file.In), nil
	}

	out, err := utils.NewTemplateExpander().
		Name(file.In).
		Data(g.context.data).
		Funcs(g.context.funcs).
		RunString(file.Out)

	if err != nil {
		return out, err
	}

	return utils.NormalizeFileExt(out, path.Ext(file.In)), nil
}

func (g *Generator) evalWhenCondition(file preset.TemplateItem) (bool, error) {
	return utils.NewTemplateExpander().
		Name(file.In).
		Data(g.context.data).
		Funcs(g.context.funcs).
		RunStringToBool(file.When, true)
}

func polishOutput(contents string, options preset.TemplatePolishOptions) string {
	v := contents

	if options.TrimStart != nil && *options.TrimStart {
		v = strings.TrimLeft(v, " \t\r\n")
	}

	if options.CompressEmptyLines != nil && *options.CompressEmptyLines {
		tooManyLinesWin := regexp.MustCompile(`(\r\n){3,}`)
		tooManyLinesUnix := regexp.MustCompile(`\n{3,}`)

		v = tooManyLinesWin.ReplaceAllString(v, "\r\n\r\n")
		v = tooManyLinesUnix.ReplaceAllString(v, "\n\n")
	}

	v = strings.ReplaceAll(v, "\r\n", "\n")
	v = strings.ReplaceAll(v, "\r", "\n")

	if runtime.GOOS == "windows" {
		v = strings.ReplaceAll(v, "\n", "\r\n")
	}

	return v
}

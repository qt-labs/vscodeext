// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package generator

import (
	"errors"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"qtcli/common"
	"qtcli/util"
	"regexp"
	"strings"
	"text/template"

	"github.com/sirupsen/logrus"
)

type Generator struct {
	env        *Env
	name       string
	preset     common.Preset
	workingDir string
	dryRun     bool
	context    Context
}

type Context struct {
	data            util.StringAnyMap
	funcs           template.FuncMap
	items           []common.TemplateItem
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

func (g *Generator) Preset(preset common.Preset) *Generator {
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
		return NewErrorResult(common.Error{
			Message: common.InputHasIssues,
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
		if !util.EntryExistsFS(g.env.FS, item.inputFileRel) {
			return NewErrorResultFrom(
				fmt.Errorf("file not found, %s", item.inputFileRel))
		}

		if util.EntryExists(item.outputFileAbs) {
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
	files, fields, err := g.readFilesAndFields()
	if err != nil {
		return err
	}

	g.context.data = g.preset.GetOptions()
	g.context.data["name"] = g.name
	g.context.funcs = getApi()
	g.context.items = files
	g.context.outputDirOffset = ""
	if g.preset.GetTypeId() == common.TargetTypeProject {
		g.context.outputDirOffset = g.name
	}

	err = g.evalFields(fields)
	if err != nil {
		return err
	}

	return nil
}

func (g *Generator) evalFields(fields []util.StringAnyMap) error {
	expander := util.NewTemplateExpander().Funcs(g.context.funcs)

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

		inputRel := g.createInputFileRel(file)
		outputRel, err := g.createOutputFileRel(file)
		if err != nil {
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

func (g *Generator) readFilesAndFields() (
	[]common.TemplateItem, []util.StringAnyMap, error) {
	dir := g.preset.GetTemplateDir()
	filePath := path.Join(dir, g.env.TemplateFileName)

	if len(dir) == 0 {
		return []common.TemplateItem{}, []util.StringAnyMap{},
			errors.New(util.Msg("cannot determine a config file path"))
	}

	if !util.EntryExistsFS(g.env.FS, filePath) {
		return []common.TemplateItem{}, []util.StringAnyMap{},
			fmt.Errorf(
				util.Msg("template definition does not exist, dir = '%v'"), dir)
	}

	template, err := common.OpenTemplateFile(g.env.FS, filePath)
	if err != nil {
		return []common.TemplateItem{}, []util.StringAnyMap{}, err
	}

	return template.GetFileItems(), template.GetFields(), nil
}

func (g *Generator) runContents(result ResultItem) error {
	// expand input file contents
	allBytes, err := util.ReadAllFromFS(g.env.FS, result.inputFileRel)

	if err != nil {
		return err
	}

	input := string(allBytes)
	var output string

	if result.templateItem.Bypass {
		output = input
	} else {
		expander := util.NewTemplateExpander().
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
		output = polishOutput(output)
		_, err = util.WriteAll([]byte(output), result.outputFileAbs)
		if err != nil {
			return err
		}
	}

	return nil
}

func (g *Generator) createInputFileRel(file common.TemplateItem) string {
	if strings.HasPrefix(file.In, "@/") {
		return file.In[2:]
	}

	return path.Join(g.preset.GetTemplateDir(), file.In)
}

func (g *Generator) createOutputFileRel(
	file common.TemplateItem) (string, error) {
	if len(file.Out) == 0 {
		return path.Base(file.In), nil
	}

	out, err := util.NewTemplateExpander().
		Name(file.In).
		Data(g.context.data).
		Funcs(g.context.funcs).
		RunString(file.Out)

	if err != nil {
		return out, err
	}

	return util.NormalizeFileExt(out, path.Ext(file.In)), nil
}

func (g *Generator) evalWhenCondition(file common.TemplateItem) (bool, error) {
	return util.NewTemplateExpander().
		Name(file.In).
		Data(g.context.data).
		Funcs(g.context.funcs).
		RunStringToBool(file.When, true)
}

func polishOutput(contents string) string {
	tooManyLinesWin := regexp.MustCompile(`(\r\n){3,}`)
	tooManyLinesUnix := regexp.MustCompile(`\n{3,}`)

	v := strings.TrimLeft(contents, " \t\r\n")
	v = tooManyLinesWin.ReplaceAllString(v, "\r\n\r\n")
	v = tooManyLinesUnix.ReplaceAllString(v, "\n\n")

	return v
}

// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package generator

import (
	"errors"
	"fmt"
	"path"
	"qtcli/common"
	"qtcli/formats"
	"qtcli/util"
	"regexp"
	"strings"
	"text/template"

	"github.com/sirupsen/logrus"
)

type Generator struct {
	env     *Env
	name    string
	preset  common.Preset
	context Context
}

type Context struct {
	data      util.StringAnyMap
	funcs     template.FuncMap
	items     []formats.TemplateItem
	outputDir string
}

func NewGenerator(name string) *Generator {
	return &Generator{
		name: name,
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

func (g *Generator) Render() (Result, error) {
	if err := g.prepContext(); err != nil {
		return Result{}, err
	}

	// expand in, out
	result, err := g.runNames()
	if err != nil {
		return Result{}, err
	}

	// check if exists
	for _, item := range result {
		if !util.EntryExistsFS(g.env.FS, item.InputFilePath) {
			logrus.Fatalf("file not found, %s", item.InputFilePath)
		}

		if util.EntryExists(item.OutputFilePath) {
			logrus.Fatalf("output already exists, %s", item.OutputFilePath)
		}
	}

	// run contents and save
	for _, item := range result {
		if err := g.runContents(item); err != nil {
			return Result{}, err
		}
	}

	return result, nil
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
	g.context.outputDir = "."
	if g.preset.GetTypeId() == common.TargetTypeProject {
		g.context.outputDir = g.name
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

func (g *Generator) runNames() (Result, error) {

	result := Result{}

	for _, file := range g.context.items {
		okay, err := g.evalWhenCondition(file)
		if err != nil {
			return Result{}, err
		}

		if !okay {
			logrus.Debug(
				"skipping generation ",
				"because 'when' condition was not satisfied")
			continue
		}

		inputPath := g.createInputPath(file)
		outputName, err := g.createOutputFileName(file)
		if err != nil {
			return Result{}, err
		}

		result = append(result, ResultItem{
			TemplateItem:   file,
			InputFilePath:  inputPath,
			OutputFilePath: path.Join(g.context.outputDir, outputName),
		})
	}

	return result, nil
}

func (g *Generator) readFilesAndFields() (
	[]formats.TemplateItem, []util.StringAnyMap, error) {
	dir := g.preset.GetTemplateDir()
	filePath := path.Join(dir, g.env.TemplateFileName)

	if len(dir) == 0 {
		return []formats.TemplateItem{}, []util.StringAnyMap{},
			errors.New(util.Msg("cannot determine a config file path"))
	}

	if !util.EntryExistsFS(g.env.FS, filePath) {
		return []formats.TemplateItem{}, []util.StringAnyMap{},
			fmt.Errorf(
				util.Msg("template definition does not exist, dir = '%v'"), dir)
	}

	template := formats.NewTemplateFileFS(g.env.FS, filePath)
	err := template.Open()
	if err != nil {
		return []formats.TemplateItem{}, []util.StringAnyMap{}, err
	}

	return template.GetFileItems(), template.GetFields(), nil
}

func (g *Generator) runContents(result ResultItem) error {
	// expand input file contents
	allBytes, err := util.ReadAllFromFS(g.env.FS, result.InputFilePath)

	if err != nil {
		return err
	}

	input := string(allBytes)
	var output string

	if result.TemplateItem.Bypass {
		output = input
	} else {
		expander := util.NewTemplateExpander().
			Data(g.context.data).
			Funcs(g.context.funcs)

		output, err = expander.
			Name(result.OutputFilePath).
			AddData("fileName", result.OutputFilePath).
			RunString(input)
	}

	if err != nil {
		return err
	}

	// save to file
	if len(g.context.outputDir) == 0 {
		return errors.New("cannot determine output directory")
	}

	output = polishOutput(output)
	_, err = util.WriteAll([]byte(output), result.OutputFilePath)
	if err != nil {
		return err
	}

	return nil
}

func (g *Generator) createInputPath(file formats.TemplateItem) string {
	if strings.HasPrefix(file.In, "@/") {
		return file.In[2:]
	}

	return path.Join(g.preset.GetTemplateDir(), file.In)
}

func (g *Generator) createOutputFileName(
	file formats.TemplateItem) (string, error) {
	if len(file.Out) == 0 {
		return path.Base(file.In), nil
	}

	return util.NewTemplateExpander().
		Name(file.In).
		Data(g.context.data).
		Funcs(g.context.funcs).
		RunString(file.Out)
}

func (g *Generator) evalWhenCondition(file formats.TemplateItem) (bool, error) {
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

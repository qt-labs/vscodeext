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
	files, err := g.readFileItems()
	if err != nil {
		return err
	}

	g.context.items = files
	g.context.data = g.preset.GetOptions()
	g.context.data["name"] = g.name
	g.context.funcs = createGeneralApi()

	g.context.outputDir = "."
	if g.preset.GetTypeId() == common.TargetTypeProject {
		g.context.outputDir = g.name
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

func (g *Generator) readFileItems() ([]formats.TemplateItem, error) {
	dir := g.preset.GetTemplateDir()
	filePath := path.Join(dir, g.env.TemplateFileName)

	if len(dir) == 0 {
		return []formats.TemplateItem{},
			errors.New(util.Msg("cannot determine a config file path"))
	}

	if !util.EntryExistsFS(g.env.FS, filePath) {
		return []formats.TemplateItem{},
			fmt.Errorf(
				util.Msg("template definition does not exist, dir = '%v'"), dir)
	}

	template := formats.NewTemplateFileFS(g.env.FS, filePath)
	err := template.Open()
	if err != nil {
		return []formats.TemplateItem{}, err
	}

	return template.GetFileItems(), nil
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
	return strings.TrimLeft(contents, " \t\r\n")
}

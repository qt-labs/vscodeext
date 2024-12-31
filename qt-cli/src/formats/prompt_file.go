// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package formats

import (
	"errors"
	"fmt"
	"io/fs"
	"qtcli/prompt"
	"qtcli/prompt/comps"
	"qtcli/util"
	"strings"

	"github.com/sirupsen/logrus"
	"gopkg.in/yaml.v3"
)

type PromptFile struct {
	fs       fs.FS
	filePath string
	contents PromptFileContents
}

type PromptFileContents struct {
	Version string              `yaml:"version"`
	Steps   []PromptStep        `yaml:"steps"`
	Consts  []util.StringAnyMap `yaml:"consts"`
}

type PromptStep struct {
	Id           string             `yaml:"id"`
	CompType     string             `yaml:"type"`
	Question     string             `yaml:"question"`
	Description  string             `yaml:"description"`
	Value        string             `yaml:"value"`
	DefaultValue interface{}        `yaml:"default"`
	When         string             `yaml:"when"`
	Items        []PromptListItem   `yaml:"items"`
	Rules        []PromptInputRules `yaml:"rules"`
}

type PromptListItem struct {
	Text        string      `yaml:"text"`
	Data        interface{} `yaml:"data"`
	Description string      `yaml:"description"`
	Checked     string      `yaml:"checked"`
}

type PromptInputRules map[string]interface{}

func NewPromptFileFS(fs fs.FS, filePath string) *PromptFile {
	return &PromptFile{
		fs:       fs,
		filePath: filePath,
	}
}

func (f *PromptFile) Open() error {
	logrus.Debug(fmt.Sprintf(
		"reading prompt definition, file = '%v'", f.filePath))

	raw, err := util.ReadAllFromFS(f.fs, f.filePath)
	if err != nil {
		return err
	}

	err = yaml.Unmarshal(raw, &f.contents)
	if err != nil {
		return err
	}

	return nil
}

func (f *PromptFile) ExtractDefaults() util.StringAnyMap {
	all := util.StringAnyMap{}

	for _, step := range f.contents.Steps {
		all[step.Id] = step.DefaultValue
	}

	for _, e := range f.contents.Consts {
		all = util.Merge(all, e)
	}

	return all
}

func (f *PromptFile) RunPrompt() (util.StringAnyMap, error) {
	answers := f.ExtractDefaults()
	expander := util.NewTemplateExpander().Data(answers)

	for _, step := range f.contents.Steps {
		expander.Name(fmt.Sprintf("steps:%v", step.Id))
		okayToRun, err := expander.RunStringToBool(step.When, true)
		if err != nil {
			return util.StringAnyMap{}, err
		}

		if !okayToRun {
			continue
		}

		prompt, err := createPrompt(step, expander)
		if err != nil {
			return util.StringAnyMap{}, err
		}

		result, err := prompt.Run()
		if err != nil {
			return util.StringAnyMap{}, err
		}

		if !result.Done {
			return util.StringAnyMap{}, errors.New("aborted")
		}

		answers[step.Id] = result.ValueNormalized()
	}

	return answers, nil
}

func createPrompt(
	step PromptStep, expander *util.TemplateExpander) (prompt.Prompt, error) {
	question, err := expander.RunString(step.Question)
	if err != nil {
		return nil, err
	}

	description, err := expander.RunString(step.Description)
	if err != nil {
		return nil, err
	}

	items, err := createListItems(step, expander)
	if err != nil {
		return nil, err
	}

	switch strings.ToLower(step.CompType) {
	case "input":
		validator, err := createInputValidator(step.Rules)
		if err != nil {
			return nil, err
		}

		return comps.NewInput().
			Id(step.Id).
			Question(question).
			Description(description).
			Value(step.Value).
			Validator(validator), nil

	case "picker":
		return comps.NewPicker().
			Id(step.Id).
			Question(question).
			Items(items), nil

	case "choices":
		return comps.NewChoices().
			Id(step.Id).
			Question(question).
			Items(items), nil

	case "confirm":
		c := comps.NewConfirm().
			Id(step.Id).
			Question(question)

		if util.ToBool(step.DefaultValue, false) {
			c.Description("Y/n").DefaultValue("y")
		} else {
			c.Description("y/N").DefaultValue("n")
		}

		return c, nil
	}

	return nil, fmt.Errorf(
		util.Msg("invalid type, given = '%v'"), step.CompType)
}

func createInputValidator(
	inputs []PromptInputRules) (comps.ValidatorFunc, error) {
	rules := comps.ValidatorRules{}

	for _, input := range inputs {
		for name, value := range input {
			atype := comps.FindValidatorType(name)
			if len(atype) != 0 {
				rules[atype] = value
			}
		}
	}

	return comps.CreateValidator(rules)
}

func createListItems(
	step PromptStep,
	expander *util.TemplateExpander) ([]comps.ListItem, error) {
	all := []comps.ListItem{}

	for _, entry := range step.Items {
		text, err := expander.RunString(entry.Text)
		if err != nil {
			return nil, err
		}

		description, err := expander.RunString(entry.Description)
		if err != nil {
			return nil, err
		}

		checked, err := expander.RunStringToBool(entry.Checked, false)
		if err != nil {
			return nil, err
		}

		item := comps.
			NewItem(text).
			Description(description).
			Data(entry.Data).
			Checked(checked)

		all = append(all, item)
	}

	return all, nil
}

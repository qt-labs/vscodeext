// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package runner

import (
	"errors"
	"fmt"
	"path"
	"qtcli/common"
	"qtcli/prompt"
	"qtcli/prompt/comps"
	"qtcli/util"
	"regexp"
	"strings"
)

func RunPromptFromDir(dir string) (util.StringAnyMap, error) {
	fullPath := path.Join(dir, common.PromptFileName)

	// note,
	// the absence of prompt definition isn't considered as an error
	// it means there is nothing to ask to the user.
	if !util.EntryExistsFS(GeneratorEnv.FS, fullPath) {
		return util.StringAnyMap{}, nil
	}

	promptFile := common.NewPromptFileFS(GeneratorEnv.FS, fullPath)
	if err := promptFile.Open(); err != nil {
		return util.StringAnyMap{}, nil
	}

	return RunPrompt(promptFile)
}

func RunFilePromptByExt(ext string) (common.Preset, error) {
	extName := ext[1:]
	templateDir := path.Join(GeneratorEnv.FileTypesBaseDir, extName)

	if !util.EntryExistsFS(GeneratorEnv.FS, templateDir) {
		return nil, fmt.Errorf(
			util.Msg("not supported file format, given = %v"), ext)
	}

	options, err := RunPromptFromDir(templateDir)
	if err != nil {
		return nil, err
	}

	return common.NewPresetData(extName, templateDir, options), nil
}

func FindPresetOrRunSelector(
	t common.TargetType, givenPresetName string) (common.Preset, error) {
	if len(givenPresetName) != 0 {
		return Presets.Any.FindByTypeAndName(t, givenPresetName)
	}

	return runPresetSelector(t)
}

func runPresetSelector(t common.TargetType) (common.Preset, error) {
	items := createPickerItems(Presets.Any.FindByType(t))
	items = append(items, comps.NewItem(util.Msg("[Manually select features]")))
	picked, err := comps.NewPicker().
		Question(util.Msg("Pick a preset")).
		Items(items).
		Run()

	if err != nil {
		return nil, err
	}

	if !picked.Done {
		return nil, errors.New(util.Msg("aborted"))
	}

	selected, _ := picked.ValueAsSelectionItem()
	item, _ := selected.Data.(common.Preset)

	if selected.Index == (len(items) - 1) {
		newitem, err := runManualConfig(t)
		if err != nil {
			return nil, err
		}

		item = newitem
	}

	return item, nil
}

func runManualConfig(t common.TargetType) (common.Preset, error) {
	pickerItems := createPickerItems(Presets.Default.FindByType(t))

	result, err := comps.NewPicker().
		Question(util.Msg("Pick an item to use:")).
		Items(pickerItems).
		Run()
	if err != nil {
		return nil, err
	}

	pickedItem, _ := result.ValueAsSelectionItem()
	selectedDefaultPreset, ok := pickedItem.Data.(common.Preset)
	if !ok {
		return nil, errors.New(util.Msg("internal error: type mismatch"))
	}

	// run prompt
	options, err := RunPromptFromDir(selectedDefaultPreset.GetTemplateDir())
	if err != nil {
		return nil, err
	}

	// build preset
	presetData := common.NewPresetData(
		selectedDefaultPreset.GetName(),
		selectedDefaultPreset.GetTemplateDir(),
		options,
	)

	// try to save
	newName := runPresetSavePrompt()

	if len(newName) != 0 {
		presetData.Name = newName
		Presets.User.GetFile().Add(presetData)
		Presets.User.GetFile().Save()
	}

	return presetData, nil
}

func RunFileNamePrompt() string {
	r, err := comps.NewInput().
		Question(util.Msg("Enter the file name:")).
		Run()

	if r.Done && err == nil {
		return strings.TrimSpace(r.Value.(string))
	}

	return ""
}

func runPresetSavePrompt() string {
	prompts := []prompt.Prompt{
		comps.NewConfirm().
			Id("confirm").
			Question(util.Msg("Save for later use?")).
			Description("Y/n"),

		comps.NewInput().
			Id("name").Question(util.Msg("Enter the preset name:")),
	}

	flow := prompt.NewFlow()
	flow.AddPrompts(prompts)
	flow.SetDoneHandler(func(p prompt.Prompt, r prompt.Result) {
		if p.GetId() == "confirm" {
			if !r.ValueAsBool(false) {
				flow.Abort()
				return
			}
		}

		flow.RunDefaultDoneHandler(p, r)
	})

	err := flow.Run()
	if err != nil {
		return ""
	}

	if flow.IsAborted() {
		return ""
	}

	r := flow.GetResult("name")
	s, ok := r.Value.(string)
	if !ok {
		return ""
	}

	return strings.TrimSpace(s)
}

func createPickerItems(presets []common.PresetData) []comps.ListItem {
	items := make([]comps.ListItem, len(presets))

	for i, preset := range presets {
		items[i] = comps.
			NewItem(preset.GetDescription()).
			Data(preset)
	}

	return items
}

func RunPrompt(f *common.PromptFile) (util.StringAnyMap, error) {
	answers := f.ExtractDefaults()
	expander := util.NewTemplateExpander().Data(answers)

	for _, step := range f.GetContents().Steps {
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
	step common.PromptStep, expander *util.TemplateExpander) (prompt.Prompt, error) {
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
		validator, err := createInputValidator(step.Id, step.Rules)
		if err != nil {
			return nil, err
		}

		return comps.NewInput().
			Id(step.Id).
			Question(question).
			Description(description).
			Value(step.Value).
			ValidateFunc(validator), nil

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
	fieldName string,
	rules []common.PromptInputRules) (comps.InputValidateFunc, error) {
	// compose validation tags
	tags := []string{}

	for _, input := range rules {
		for name, value := range input {
			tag, err := createInputValidatorTag(name, value)
			if err != nil {
				return nil, err
			}

			if len(tag) != 0 {
				tags = append(tags, tag)
			}
		}
	}

	// nothing to validate
	if len(tags) == 0 {
		return nil, nil
	}

	// create validation function
	v := common.NewStringValidator()
	tag := strings.Join(tags, ",")

	return func(data string) error {
		issue := v.Run(fieldName, data, tag)
		if issue != nil {
			return errors.New(issue.Message)
		}

		return nil
	}, nil
}

func createInputValidatorTag(name string, value any) (string, error) {
	aname := strings.ToLower(strings.TrimSpace(name))

	if aname == common.TagRequired {
		avalue, ok := value.(bool)
		if !ok {
			return "", errors.New(
				util.Msg("invalid argument: boolean expected"))
		}

		if avalue {
			return common.TagRequired, nil
		}

		return "", nil
	}

	if aname == common.TagMatch {
		pattern, ok := value.(string)
		if !ok {
			return "", errors.New(
				util.Msg("invalid argument: string expected"))
		}

		_, err := regexp.Compile(pattern)
		if err != nil {
			return "", fmt.Errorf(util.Msg("invalid pattern: '%w'"), pattern)
		}

		return common.TagMatch + "=" + pattern, nil
	}

	return "", nil
}

func createListItems(
	step common.PromptStep,
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

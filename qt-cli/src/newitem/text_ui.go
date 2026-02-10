// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package newitem

import (
	"errors"
	"fmt"
	"path"
	"qtcli/common/prompt"
	"qtcli/common/utils"
	"qtcli/common/validation"
	"qtcli/newitem/preset"
	"regexp"
	"strings"
)

func RunPromptFromDir(dir string) (utils.StringAnyMap, error) {
	fullPath := path.Join(dir, preset.PromptFileName)

	// note,
	// the absence of prompt definition isn't considered as an error
	// it means there is nothing to ask to the user.
	if !utils.EntryExistsFS(GeneratorEnv.FS, fullPath) {
		return utils.StringAnyMap{}, nil
	}

	promptFile := preset.NewPromptFileFS(GeneratorEnv.FS, fullPath)
	if err := promptFile.Open(); err != nil {
		return utils.StringAnyMap{}, nil
	}

	return RunPrompt(promptFile)
}

func RunFilePromptByExt(ext string) (preset.Preset, error) {
	extName := ext[1:]
	templateDir := path.Join(GeneratorEnv.FileTypesBaseDir, extName)

	if !utils.EntryExistsFS(GeneratorEnv.FS, templateDir) {
		return nil, fmt.Errorf(
			utils.Msg("not supported file format, given = %v"), ext)
	}

	options, err := RunPromptFromDir(templateDir)
	if err != nil {
		return nil, err
	}

	return preset.NewPresetData(extName, templateDir, options), nil
}

func FindPresetOrRunSelector(
	t preset.TargetType, givenPresetName string) (preset.Preset, error) {
	if len(givenPresetName) != 0 {
		return Presets.Any.FindByTypeAndName(t, givenPresetName)
	}

	return runPresetSelector(t)
}

func runPresetSelector(t preset.TargetType) (preset.Preset, error) {
	items := createPickerItems(Presets.Any.FindByType(t))
	items = append(items, prompt.NewItem(utils.Msg("[Manually select features]")))
	picked, err := prompt.NewPicker().
		Question(utils.Msg("Pick a preset")).
		Items(items).
		Run()

	if err != nil {
		return nil, err
	}

	if !picked.Done {
		return nil, errors.New(utils.Msg("aborted"))
	}

	selected, _ := picked.ValueAsSelectionItem()
	item, _ := selected.Data.(preset.Preset)

	if selected.Index == (len(items) - 1) {
		newitem, err := runManualConfig(t)
		if err != nil {
			return nil, err
		}

		item = newitem
	}

	return item, nil
}

func runManualConfig(t preset.TargetType) (preset.Preset, error) {
	pickerItems := createPickerItems(Presets.Default.FindByType(t))

	result, err := prompt.NewPicker().
		Question(utils.Msg("Pick an item to use:")).
		Items(pickerItems).
		Run()
	if err != nil {
		return nil, err
	}

	pickedItem, _ := result.ValueAsSelectionItem()
	selectedDefaultPreset, ok := pickedItem.Data.(preset.Preset)
	if !ok {
		return nil, errors.New(utils.Msg("internal error: type mismatch"))
	}

	// run prompt
	options, err := RunPromptFromDir(selectedDefaultPreset.GetTemplateDir())
	if err != nil {
		return nil, err
	}

	// build preset
	presetData := preset.NewPresetData(
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
	r, err := prompt.NewInput().
		Question(utils.Msg("Enter the file name:")).
		Run()

	if r.Done && err == nil {
		return strings.TrimSpace(r.Value.(string))
	}

	return ""
}

func runPresetSavePrompt() string {
	prompts := []prompt.Prompt{
		prompt.NewConfirm().
			Id("confirm").
			Question(utils.Msg("Save for later use?")).
			Description("Y/n"),

		prompt.NewInput().
			Id("name").Question(utils.Msg("Enter the preset name:")),
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

func createPickerItems(presets []preset.PresetData) []prompt.ListItem {
	items := make([]prompt.ListItem, len(presets))

	for i, preset := range presets {
		items[i] = prompt.
			NewItem(preset.GetDescription()).
			Data(preset)
	}

	return items
}

func RunPrompt(f *preset.PromptFile) (utils.StringAnyMap, error) {
	answers := f.ExtractDefaults()
	expander := utils.NewTemplateExpander().Data(answers)

	for _, step := range f.GetContents().Steps {
		expander.Name(fmt.Sprintf("steps:%v", step.Id))
		okayToRun, err := expander.RunStringToBool(step.When, true)
		if err != nil {
			return utils.StringAnyMap{}, err
		}

		if !okayToRun {
			continue
		}

		prompt, err := createPrompt(step, expander)
		if err != nil {
			return utils.StringAnyMap{}, err
		}

		result, err := prompt.Run()
		if err != nil {
			return utils.StringAnyMap{}, err
		}

		if !result.Done {
			return utils.StringAnyMap{}, errors.New("aborted")
		}

		answers[step.Id] = result.ValueNormalized()
	}

	return answers, nil
}

func createPrompt(
	step preset.PromptStep, expander *utils.TemplateExpander) (prompt.Prompt, error) {
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

		return prompt.NewInput().
			Id(step.Id).
			Question(question).
			Description(description).
			Value(step.Value).
			ValidateFunc(validator), nil

	case "picker":
		return prompt.NewPicker().
			Id(step.Id).
			Question(question).
			Items(items), nil

	case "choices":
		return prompt.NewChoices().
			Id(step.Id).
			Question(question).
			Items(items), nil

	case "confirm":
		c := prompt.NewConfirm().
			Id(step.Id).
			Question(question)

		if utils.ToBool(step.DefaultValue, false) {
			c.Description("Y/n").DefaultValue("y")
		} else {
			c.Description("y/N").DefaultValue("n")
		}

		return c, nil
	}

	return nil, fmt.Errorf(
		utils.Msg("invalid type, given = '%v'"), step.CompType)
}

func createInputValidator(
	fieldName string,
	rules []preset.PromptInputRules) (prompt.InputValidateFunc, error) {
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
	v := validation.NewStringValidator()
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

	if aname == validation.TagRequired {
		avalue, ok := value.(bool)
		if !ok {
			return "", errors.New(
				utils.Msg("invalid argument: boolean expected"))
		}

		if avalue {
			return validation.TagRequired, nil
		}

		return "", nil
	}

	if aname == validation.TagMatch {
		pattern, ok := value.(string)
		if !ok {
			return "", errors.New(
				utils.Msg("invalid argument: string expected"))
		}

		_, err := regexp.Compile(pattern)
		if err != nil {
			return "", fmt.Errorf(utils.Msg("invalid pattern: '%w'"), pattern)
		}

		return validation.TagMatch + "=" + pattern, nil
	}

	return "", nil
}

func createListItems(
	step preset.PromptStep,
	expander *utils.TemplateExpander) ([]prompt.ListItem, error) {
	all := []prompt.ListItem{}

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

		item := prompt.
			NewItem(text).
			Description(description).
			Data(entry.Data).
			Checked(checked)

		all = append(all, item)
	}

	return all, nil
}

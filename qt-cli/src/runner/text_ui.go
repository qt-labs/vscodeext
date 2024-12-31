// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package runner

import (
	"errors"
	"fmt"
	"path"
	"qtcli/common"
	"qtcli/formats"
	"qtcli/prompt"
	"qtcli/prompt/comps"
	"qtcli/util"
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

	promptFile := formats.NewPromptFileFS(GeneratorEnv.FS, fullPath)
	if err := promptFile.Open(); err != nil {
		return util.StringAnyMap{}, nil
	}

	return promptFile.RunPrompt()
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

	return common.PresetData{
		Name:        extName,
		TypeName:    common.TargetTypeToString(common.TargetTypeFile),
		TemplateDir: templateDir,
		Options:     options,
	}, nil
}

func FindPresetOrRunSelector(
	t common.TargetType, givenPresetName string) (common.Preset, error) {
	if len(givenPresetName) != 0 {
		return findPresetByName(t, givenPresetName)
	}

	return runPresetSelector(t)
}

func findPresetByName(
	t common.TargetType, givenPresetName string) (common.Preset, error) {
	if strings.HasPrefix(givenPresetName, "@") {
		return FindDefaultPresetByTemplateDir(t, givenPresetName[1:])
	}

	return AllUserPresets.Find(t, givenPresetName)
}

func runPresetSelector(t common.TargetType) (common.Preset, error) {
	all := []common.Preset{}
	all = append(all, toPresetList(AllUserPresets.GetItemsOfTargetType(t))...)
	all = append(all, toPresetList(FindDefaultPresets(t))...)

	items := createPickerItems(all)
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
	presetItems := toPresetList(FindDefaultPresets(t))
	pickerItems := createPickerItems(presetItems)

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
	presetData := common.PresetData{
		Name:        selectedDefaultPreset.GetName(),
		TypeName:    common.TargetTypeToString(t),
		TemplateDir: selectedDefaultPreset.GetTemplateDir(),
		Options:     options,
	}

	// try to save
	newName := runPresetSavePrompt()

	if len(newName) != 0 {
		presetData.Name = newName
		AllUserPresets.Add(presetData)
		AllUserPresets.Save()
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

func createPickerItems(presets []common.Preset) []comps.ListItem {
	items := make([]comps.ListItem, len(presets))

	for i, preset := range presets {
		items[i] = comps.
			NewItem(preset.GetName()).
			Description(preset.GetDescription()).
			Data(preset)
	}

	return items
}

func toPresetList[T common.Preset](items []T) []common.Preset {
	all := make([]common.Preset, len(items))

	for i, item := range items {
		all[i] = item
	}

	return all
}

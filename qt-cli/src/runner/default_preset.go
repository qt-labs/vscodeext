// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package runner

import (
	"errors"
	"io/fs"
	"path"
	"qtcli/common"
	"qtcli/util"
)

type DefaultPresetManager struct {
	baseFS  fs.FS
	presets map[common.TargetType][]common.PresetData
}

func NewDefaultPresetManager(baseFS fs.FS) DefaultPresetManager {
	presets := map[common.TargetType][]common.PresetData{
		common.TargetTypeFile:    loadPresets(baseFS, common.TargetTypeFile),
		common.TargetTypeProject: loadPresets(baseFS, common.TargetTypeProject),
	}

	return DefaultPresetManager{
		baseFS:  baseFS,
		presets: presets,
	}
}

func (m DefaultPresetManager) GetAll() []common.PresetData {
	return append(
		m.FindByType(common.TargetTypeProject),
		m.FindByType(common.TargetTypeFile)...,
	)
}

func (m DefaultPresetManager) FindByType(
	t common.TargetType,
) []common.PresetData {
	presets, exists := m.presets[t]
	if exists {
		return presets
	}

	return []common.PresetData{}
}

func (m DefaultPresetManager) FindByName(n string) (common.PresetData, error) {
	all := m.GetAll()

	for _, preset := range all {
		if preset.GetName() == n {
			return preset, nil
		}
	}

	return common.PresetData{}, errors.New("not found")
}

func (m DefaultPresetManager) FindByTypeAndName(
	t common.TargetType,
	name string,
) (common.PresetData, error) {
	return common.FindByTypeAndName(m, t, name)
}

func (m DefaultPresetManager) FindByUniqueId(id string) (common.PresetData, error) {
	for _, preset := range m.GetAll() {
		if preset.GetUniqueId() == id {
			return preset, nil
		}
	}

	return common.PresetData{}, errors.New("not found")
}

// helpers
func loadPresets(baseFS fs.FS, t common.TargetType) []common.PresetData {
	all := []common.PresetData{}
	dirs, err := findAllTemplateDirNames(baseFS, t)

	if err == nil {
		for _, dir := range dirs {
			p := common.NewPresetData("@"+dir, dir, readDefaultOptions(baseFS, dir))
			all = append(all, p)
		}
	}

	return all
}

func findAllTemplateDirNames(
	baseFS fs.FS,
	t common.TargetType,
) ([]string, error) {
	var found []string

	err := fs.WalkDir(baseFS, ".",
		func(walkingPath string, d fs.DirEntry, err error) error {
			if err != nil {
				return err
			}

			if d.IsDir() && walkingPath != "." {
				fullPath := path.Join(walkingPath, common.TemplateFileName)
				templateFile, err := common.OpenTemplateFile(baseFS, fullPath)
				if err == nil && templateFile.GetTargetType() == t {
					found = append(found, walkingPath)
				}
			}

			return nil
		})

	return found, err
}

func readDefaultOptions(baseFS fs.FS, templateDir string) util.StringAnyMap {
	fullPath := path.Join(templateDir, common.PromptFileName)

	f := common.NewPromptFileFS(baseFS, fullPath)
	if err := f.Open(); err != nil {
		return util.StringAnyMap{}
	}

	return f.ExtractDefaults()
}

// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package preset

import (
	"errors"
	"io/fs"
	"path"
	"qtcli/common/utils"
)

type DefaultPresetManager struct {
	baseFS  fs.FS
	presets map[TargetType][]PresetData
}

func NewDefaultPresetManager(baseFS fs.FS) DefaultPresetManager {
	presets := map[TargetType][]PresetData{
		TargetTypeFile:    loadPresets(baseFS, TargetTypeFile),
		TargetTypeProject: loadPresets(baseFS, TargetTypeProject),
	}

	return DefaultPresetManager{
		baseFS:  baseFS,
		presets: presets,
	}
}

func (m DefaultPresetManager) GetAll() []PresetData {
	return append(
		m.FindByType(TargetTypeProject),
		m.FindByType(TargetTypeFile)...,
	)
}

func (m DefaultPresetManager) FindByType(
	t TargetType,
) []PresetData {
	presets, exists := m.presets[t]
	if exists {
		return presets
	}

	return []PresetData{}
}

func (m DefaultPresetManager) FindByName(n string) (PresetData, error) {
	all := m.GetAll()

	for _, preset := range all {
		if preset.GetName() == n {
			return preset, nil
		}
	}

	return PresetData{}, errors.New("not found")
}

func (m DefaultPresetManager) FindByTypeAndName(
	t TargetType,
	name string,
) (PresetData, error) {
	return FindByTypeAndName(m, t, name)
}

func (m DefaultPresetManager) FindByUniqueId(id string) (PresetData, error) {
	for _, preset := range m.GetAll() {
		if preset.GetUniqueId() == id {
			return preset, nil
		}
	}

	return PresetData{}, errors.New("not found")
}

// helpers
func loadPresets(baseFS fs.FS, t TargetType) []PresetData {
	all := []PresetData{}
	dirs, err := findAllTemplateDirNames(baseFS, t)

	if err == nil {
		for _, dir := range dirs {
			p := NewPresetData("@"+dir, dir, readDefaultOptions(baseFS, dir))
			all = append(all, p)
		}
	}

	return all
}

func findAllTemplateDirNames(
	baseFS fs.FS,
	t TargetType,
) ([]string, error) {
	var found []string

	err := fs.WalkDir(baseFS, ".",
		func(walkingPath string, d fs.DirEntry, err error) error {
			if err != nil {
				return err
			}

			if d.IsDir() && walkingPath != "." {
				fullPath := path.Join(walkingPath, TemplateFileName)
				templateFile, err := OpenTemplateFile(baseFS, fullPath)
				if err == nil && templateFile.GetTargetType() == t {
					found = append(found, walkingPath)
				}
			}

			return nil
		})

	return found, err
}

func readDefaultOptions(baseFS fs.FS, templateDir string) utils.StringAnyMap {
	fullPath := path.Join(templateDir, PromptFileName)

	f := NewPromptFileFS(baseFS, fullPath)
	if err := f.Open(); err != nil {
		return utils.StringAnyMap{}
	}

	return f.ExtractDefaults()
}

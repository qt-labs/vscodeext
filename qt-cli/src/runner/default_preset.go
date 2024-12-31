// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package runner

import (
	"fmt"
	"io/fs"
	"path"
	"qtcli/common"
	"qtcli/formats"
	"qtcli/util"
)

type DefaultPresets struct {
	Type         common.TargetType
	TemplateDirs []string
}

type DefaultPreset struct {
	Name        string
	TypeId      common.TargetType
	TemplateDir string
}

func (p DefaultPreset) GetName() string {
	return p.Name
}

func (p DefaultPreset) GetTypeId() common.TargetType {
	return p.TypeId
}

func (p DefaultPreset) GetDescription() string {
	return ""
}

func (p DefaultPreset) GetTemplateDir() string {
	return p.TemplateDir
}

func (p DefaultPreset) GetOptions() util.StringAnyMap {
	fullPath := path.Join(
		p.TemplateDir,
		common.PromptFileName)

	f := formats.NewPromptFileFS(GeneratorEnv.FS, fullPath)
	if err := f.Open(); err != nil {
		return util.StringAnyMap{}
	}

	return f.ExtractDefaults()
}

func (p DefaultPreset) ToPresetData() common.PresetData {
	return common.PresetData{
		Name:        p.Name,
		TypeName:    common.TargetTypeToString(p.TypeId),
		TemplateDir: p.TemplateDir,
		Options:     p.GetOptions(),
	}
}

// helpers
func FindAllDefaultPresets() []DefaultPreset {
	all := []DefaultPreset{}
	all = append(all, FindDefaultPresets(common.TargetTypeProject)...)
	all = append(all, FindDefaultPresets(common.TargetTypeFile)...)

	return all
}

func FindDefaultPresets(t common.TargetType) []DefaultPreset {
	all := []DefaultPreset{}
	names, err := findAllDefaultPresetNames(t)

	if err == nil {
		for _, name := range names {
			all = append(all, DefaultPreset{
				Name:        "[Default] @" + name,
				TypeId:      t,
				TemplateDir: name,
			})
		}
	}

	return all
}

func FindDefaultPresetByTemplateDir(t common.TargetType, dir string) (
	DefaultPreset, error) {
	presets := FindDefaultPresets(t)

	for _, preset := range presets {
		if dir == preset.TemplateDir {
			return preset, nil
		}
	}

	return DefaultPreset{},
		fmt.Errorf(util.Msg("cannot find default preset, given = '%v'"), dir)
}

func findAllDefaultPresetNames(t common.TargetType) ([]string, error) {
	var found []string

	err := fs.WalkDir(GeneratorEnv.FS, ".",
		func(walkingPath string, d fs.DirEntry, err error) error {
			if err != nil {
				return err
			}

			if d.IsDir() && walkingPath != "." {
				fullPath := path.Join(walkingPath, common.TemplateFileName)
				templateFile := formats.NewTemplateFileFS(
					GeneratorEnv.FS, fullPath)
				err := templateFile.Open()

				if err == nil && templateFile.GetTargetType() == t {
					found = append(found, walkingPath)
				}
			}

			return nil
		})

	return found, err
}

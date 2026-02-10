// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package newitem

import (
	"os"
	"path"
	"qtcli/newitem/generator"
	"qtcli/newitem/preset"

	"github.com/sirupsen/logrus"
)

var GeneratorEnv *generator.Env

var Presets struct {
	Default preset.DefaultPresetManager
	User    preset.UserPresetManager
	Any     preset.CompositePresetManager
}

func init() {
	GeneratorEnv = &generator.Env{
		FS:               preset.TemplatesFS,
		FileTypesBaseDir: "types",
		TemplateFileName: preset.TemplateFileName,
	}

	// user presets
	home, err := os.UserHomeDir()
	if err != nil {
		logrus.Fatal(err)
	}

	fullPath := path.Join(home, preset.UserPresetFileName)
	userPresets := preset.NewUserPresetFile(fullPath)
	if err := userPresets.Open(); err != nil {
		logrus.Fatal(err)
	}

	// preset managers
	userPresetManager := preset.NewUserPresetManager(userPresets)
	defaultPresetManager := preset.NewDefaultPresetManager(GeneratorEnv.FS)

	Presets = struct {
		Default preset.DefaultPresetManager
		User    preset.UserPresetManager
		Any     preset.CompositePresetManager
	}{
		Default: defaultPresetManager,
		User:    userPresetManager,
		Any: preset.NewCompositePresetManager(
			userPresetManager,
			defaultPresetManager,
		),
	}
}

// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package runner

import (
	"os"
	"path"
	"qtcli/common"
	"qtcli/generator"

	"github.com/sirupsen/logrus"
)

var GeneratorEnv *generator.Env

var Presets struct {
	Default DefaultPresetManager
	User    common.UserPresetManager
	Any     common.CompositePresetManager
}

func init() {
	GeneratorEnv = &generator.Env{
		FS:               common.TemplatesFS,
		FileTypesBaseDir: "types",
		TemplateFileName: common.TemplateFileName,
	}

	// user presets
	home, err := os.UserHomeDir()
	if err != nil {
		logrus.Fatal(err)
	}

	fullPath := path.Join(home, common.UserPresetFileName)
	userPresets := common.NewUserPresetFile(fullPath)
	if err := userPresets.Open(); err != nil {
		logrus.Fatal(err)
	}

	// preset managers
	userPresetManager := common.NewUserPresetManager(userPresets)
	defaultPresetManager := NewDefaultPresetManager(GeneratorEnv.FS)

	Presets = struct {
		Default DefaultPresetManager
		User    common.UserPresetManager
		Any     common.CompositePresetManager
	}{
		Default: defaultPresetManager,
		User:    userPresetManager,
		Any: common.NewCompositePresetManager(
			userPresetManager,
			defaultPresetManager,
		),
	}
}

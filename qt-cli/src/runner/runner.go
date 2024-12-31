// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package runner

import (
	"io/fs"
	"os"
	"path"
	"qtcli/assets"
	"qtcli/common"
	"qtcli/formats"
	"qtcli/generator"

	"github.com/sirupsen/logrus"
)

var GeneratorEnv *generator.Env
var AllUserPresets *formats.UserPresetFile

func init() {
	baseFS, err := fs.Sub(assets.Assets, "templates")
	if err != nil {
		logrus.Fatal(err)
	}

	GeneratorEnv = &generator.Env{
		FS:               baseFS,
		FileTypesBaseDir: "types",
		TemplateFileName: common.TemplateFileName,
	}

	// user presets
	home, err := os.UserHomeDir()
	if err != nil {
		logrus.Fatal(err)
	}

	fullPath := path.Join(home, common.UserPresetFileName)
	userPresets := formats.NewUserPresetFile(fullPath)
	if err := userPresets.Open(); err != nil {
		logrus.Fatal(err)
	}

	AllUserPresets = userPresets
}

// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package e2e

import (
	"path/filepath"
	"testing"
)

type ProjectPreset struct {
	name          string
	expectedFiles []string
}

func TestNewProject(t *testing.T) {
	projectName := "myapp"
	presets := []ProjectPreset{
		{"cpp/console", []string{"CMakeLists.txt", "main.cpp"}},
		{"cpp/qtquick", []string{"CMakeLists.txt", "main.cpp", "Main.qml"}},
		{"cpp/qwidget", []string{
			"CMakeLists.txt", "main.cpp",
			"mainwindow.cpp", "mainwindow.h", "mainwindow.ui",
		}},
	}

	for _, preset := range presets {
		checker := func(workingDir string) {
			projectDir := filepath.Join(workingDir, projectName)
			CheckDirHasFiles(t, projectDir, preset.expectedFiles)
		}

		t.Run(preset.name, func(t *testing.T) {
			args := []string{
				"new", projectName,
				"--preset", "@projects/" + preset.name,
			}

			RunQtcli(t, checker, args...)
		})
	}
}

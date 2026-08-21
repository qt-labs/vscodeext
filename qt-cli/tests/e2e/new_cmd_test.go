// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package e2e

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

type NewCmdTestData struct {
	presetName string
	appName    string
}

func TestNewCmd(t *testing.T) {
	allTestData := []NewCmdTestData{
		{"@projects/cpp/console", "projects_cpp_console"},
		{"@projects/cpp/qtquick", "projects_cpp_qtquick"},
		{"@projects/cpp/qwidget", "projects_cpp_qwidget"},
		{"@projects/csharp/qtbridge", "projects_csharp_qtbridge"},
		{"@projects/python/qtquick", "projects_python_qtquick"},
		{"@projects/python/qwidget", "projects_python_qwidget"},
	}

	for _, data := range allTestData {
		t.Run(data.presetName, func(t *testing.T) {
			checker := func(workingDir string) bool {
				cwd, _ := os.Getwd()
				actual, _ := filepath.Rel(cwd, filepath.Join(workingDir, data.appName))
				actual = strings.ReplaceAll(actual, "\\", "/")
				expected := "./expected_outputs/" + data.appName
				return CheckDirsEqual(t, actual, expected)
			}

			args := []string{
				"new", data.appName,
				"--preset", data.presetName,
			}

			RunQtcli(t, checker, args...)
		})
	}
}

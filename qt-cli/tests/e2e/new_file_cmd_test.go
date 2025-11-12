// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package e2e

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

type NewFileCmdTestData struct {
	presetName       string
	outputName       string
	expectedOuputDir string
}

func TestNewFileCmd(t *testing.T) {
	allTestData := []NewFileCmdTestData{
		{"@types/qml", "myitem", "types_qml"},
		{"@types/qrc", "myasset", "types_qrc"},
		{"@types/ui", "myui", "types_ui"},
		{"@cpp/class", "MyClass", "cpp_class"},
	}

	for _, data := range allTestData {
		t.Run(data.presetName, func(t *testing.T) {
			checker := func(workingDir string) bool {
				cwd, _ := os.Getwd()
				actual, _ := filepath.Rel(cwd, workingDir)
				actual = strings.ReplaceAll(actual, "\\", "/")

				expected := "./expected_outputs/" + data.expectedOuputDir
				return CheckDirsEqual(t, actual, expected)
			}

			args := []string{
				"new-file", data.outputName,
				"--preset", data.presetName,
			}

			RunQtcli(t, checker, args...)
		})
	}
}

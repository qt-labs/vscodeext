// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package e2e

import (
	"fmt"
	"testing"
)

func TestNewFileCppClass(t *testing.T) {
	presets := []struct {
		nameArg       string
		presetName    string
		expectedFiles []string
	}{
		{
			"myobject",
			"@cpp/class",
			[]string{"myobject.cpp", "myobject.h"},
		},
		{
			"MyObject",
			"@cpp/class",
			[]string{"MyObject.cpp", "MyObject.h"},
		},
	}

	for _, preset := range presets {
		checker := func(workingDir string) {
			CheckDirHasFiles(t, workingDir, preset.expectedFiles)
		}

		testName := fmt.Sprintf(
			"%s (%s)", preset.presetName, preset.nameArg)

		t.Run(testName, func(t *testing.T) {
			args := []string{
				"new-file", preset.nameArg,
				"--preset", preset.presetName,
			}

			RunQtcli(t, checker, args...)
		})
	}
}

// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package e2e

import (
	"path/filepath"
	"testing"
)

func TestNewFile(t *testing.T) {
	name := "myfile"
	exts := []string{"qrc", "qml", "ui"}

	for _, ext := range exts {
		checker := func(workingDir string) {
			fileName := name + "." + ext
			fullPath := filepath.Join(workingDir, fileName)
			CheckFileExists(t, fullPath)
		}

		t.Run(ext, func(t *testing.T) {
			args := []string{
				"new-file", name,
				"--preset", "@types/" + ext,
			}

			RunQtcli(t, checker, args...)
		})
	}
}

// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package util

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNormalizeFileExt(t *testing.T) {
	tests := []struct {
		fileName    string
		fallbackExt string
		expected    string
	}{
		// normal extension appending when no extension exists
		{"my", "qml", "my.qml"},
		{"my", ".qml", "my.qml"},
		{"my.", "qml", "my.qml"},
		{"my.", ".qml", "my.qml"},

		// already has correct extension — should stay unchanged
		{"my.qml", "", "my.qml"},
		{"my.qml", "qml", "my.qml"},
		{"my.qml", ".qml", "my.qml"},

		// has different extension — should stay unchanged
		{"my.txt", "", "my.txt"},
		{"my.txt", "qml", "my.txt"},
		{"my.txt", ".qml", "my.txt"},

		// has multiple extensions — should stay unchanged
		{"my.tar.gz", "", "my.tar.gz"},
		{"my.tar.gz", "qml", "my.tar.gz"},
		{"my.tar.gz", ".qml", "my.tar.gz"},

		// edge cases
		{"", "", ""},
		{"", "someignore", ".someignore"},
		{"", ".someignore", ".someignore"},

		{"wierdbutvalidfile..", "", "wierdbutvalidfile"},
		{"wierdbutvalidfile..", "qml", "wierdbutvalidfile.qml"},
		{"wierdbutvalidfile..", ".qml", "wierdbutvalidfile.qml"},
	}

	for _, tc := range tests {
		testname := fmt.Sprintf("|%s|%s|", tc.fileName, tc.fallbackExt)
		t.Run(testname, func(t *testing.T) {
			actual := NormalizeFileExt(tc.fileName, tc.fallbackExt)
			require.Equal(t,
				tc.expected, actual,
				fmt.Sprintf("expected '%s', got '%s'", tc.expected, actual),
			)
		})
	}
}

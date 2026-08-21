// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package generator

import "testing"

func TestCSharpNamespace(t *testing.T) {
	tests := []struct {
		name     string
		expected string
	}{
		{"HelloWorld", "HelloWorld"},
		{"hello-world", "hello_world"},
		{"class", "@class"},
	}

	api := GlobalApi{}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if actual := api.CSharpNamespace(test.name); actual != test.expected {
				t.Fatalf("CSharpNamespace(%q) = %q, want %q", test.name, actual, test.expected)
			}
		})
	}
}

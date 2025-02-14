// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package generator

import (
	"fmt"
	"regexp"
	"strings"
)

type CppApi struct{}

func (CppApi) ExtractClassName(name string) string {
	parts := strings.Split(name, "::")
	if len(parts) == 0 {
		return ""
	}

	return parts[len(parts)-1]
}

func (CppApi) ExtractNamespaces(name string) []string {
	parts := strings.Split(name, "::")
	if len(parts) <= 1 {
		return []string{}
	}

	return parts[:len(parts)-1]
}

func (cpp CppApi) MakeIncludeGuard(name string) string {
	re := regexp.MustCompile(`[^A-Z0-9]`)
	n := cpp.ExtractClassName(name)
	n = strings.ToUpper(n)
	n = re.ReplaceAllString(n, "_")

	return fmt.Sprintf("%s_H", n)
}

// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package generator

import (
	"qtcli/common/utils"
	"strings"
)

type GlobalApi struct{}

func (GlobalApi) ParseFloat(name any) float64 {
	return utils.ToFloat64(name, 0)
}

func (GlobalApi) NewArray(values ...any) []any {
	return values
}

func (GlobalApi) Reverse(slice []string) []string {
	for i, j := 0, len(slice)-1; i < j; i, j = i+1, j-1 {
		slice[i], slice[j] = slice[j], slice[i]
	}
	return slice
}

func (GlobalApi) Append(s []any, values any) []any {
	return append(s, values)
}

func (GlobalApi) AppendIf(s []any, values any, condition bool) []any {
	if condition {
		return append(s, values)
	} else {
		return s
	}
}

func (GlobalApi) CSharpNamespace(name string) string {
	identifier := strings.ReplaceAll(name, "-", "_")
	if cSharpKeywords[identifier] {
		return "@" + identifier
	}
	return identifier
}

var cSharpKeywords = map[string]bool{
	"abstract": true, "as": true, "base": true, "bool": true, "break": true,
	"byte": true, "case": true, "catch": true, "char": true, "checked": true,
	"class": true, "const": true, "continue": true, "decimal": true,
	"default": true, "delegate": true, "do": true, "double": true, "else": true,
	"enum": true, "event": true, "explicit": true, "extern": true, "false": true,
	"finally": true, "fixed": true, "float": true, "for": true, "foreach": true,
	"goto": true, "if": true, "implicit": true, "in": true, "int": true,
	"interface": true, "internal": true, "is": true, "lock": true, "long": true,
	"namespace": true, "new": true, "null": true, "object": true, "operator": true,
	"out": true, "override": true, "params": true, "private": true, "protected": true,
	"public": true, "readonly": true, "ref": true, "return": true, "sbyte": true,
	"sealed": true, "short": true, "sizeof": true, "stackalloc": true,
	"static": true, "string": true, "struct": true, "switch": true, "this": true,
	"throw": true, "true": true, "try": true, "typeof": true, "uint": true,
	"ulong": true, "unchecked": true, "unsafe": true, "ushort": true, "using": true,
	"virtual": true, "void": true, "volatile": true, "while": true,
}

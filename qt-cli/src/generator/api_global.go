// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package generator

import (
	"qtcli/util"
)

type GlobalApi struct{}

func (GlobalApi) ParseFloat(name any) float64 {
	return util.ToFloat64(name, 0)
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

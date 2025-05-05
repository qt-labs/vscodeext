// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package generator

import (
	"text/template"
)

var global = GlobalApi{}

var all = template.FuncMap{
	"Qt": func() GlobalApi {
		return global
	},
}

func getApi() template.FuncMap {
	return all
}

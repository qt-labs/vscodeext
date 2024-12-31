// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package generator

import (
	"os"
	"qtcli/util"
	"text/template"
)

func createGeneralApi() template.FuncMap {
	return template.FuncMap{
		"qEnv": func(name string) string {
			return os.Getenv(name)
		},

		"qParseFloat": func(name interface{}) float64 {
			return util.ToFloat64(name, 0)
		},
	}
}

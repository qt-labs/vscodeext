// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package generator

import "io/fs"

type Env struct {
	FS               fs.FS
	FileTypesBaseDir string
	TemplateFileName string
}

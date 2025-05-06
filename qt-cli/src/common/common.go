// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package common

import (
	"io/fs"
	"qtcli/assets"

	"github.com/sirupsen/logrus"
)

const PromptFileName = "prompt.yml"
const TemplateFileName = "templates.yml"
const UserPresetFileName = ".qtcli.preset"

var TemplatesFS fs.FS

func init() {
	fs_, err := fs.Sub(assets.Assets, "templates")
	if err != nil {
		logrus.Fatal(err)
	}

	TemplatesFS = fs_
}

// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package common

import (
	"fmt"

	"github.com/charmbracelet/lipgloss"
)

const QtCliName = "Qt CLI"
const QtCliExec = "qtcli"
const QtCliVersion = "0.1"

var QtCliInfoString string
var QtCliInfoDecorated string

const PromptFileName = "prompt.yml"
const TemplateFileName = "templates.yml"
const UserPresetFileName = ".qtcli.preset"

func init() {
	QtCliInfoString = fmt.Sprintf("%s v%s", QtCliName, QtCliVersion)
	QtCliInfoDecorated = lipgloss.
		NewStyle().
		Foreground(lipgloss.Color("#5a33f7")).
		Render(QtCliInfoString)

}

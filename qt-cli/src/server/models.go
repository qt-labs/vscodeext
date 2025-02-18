// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package server

import "qtcli/util"

type ResGetPreset struct {
	Type        string            `json:"type"`
	Name        string            `json:"name"`
	Description string            `json:"description"`
	TemplateDir string            `json:"templateDir"`
	Options     util.StringAnyMap `json:"options"`
}

type ReqPostFileOrProject struct {
	Name       string `json:"name" binding:"required"`
	Preset     string `json:"preset" binding:"required"`
	WorkingDir string `json:"workingDir" binding:"required"`
}

type ResNew struct {
	Message string               `json:"message" binding:"required"`
	Files   []string             `json:"files" binding:"required"`
	Input   ReqPostFileOrProject `json:"input" binding:"required"`
}

// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package common

import "strings"

type TargetType string

const (
	TargetTypeFile    TargetType = "File"
	TargetTypeProject TargetType = "Project"
)

func TargetTypeFromString(s string) TargetType {
	if strings.ToLower(s) == "project" {
		return TargetTypeProject
	}

	return TargetTypeFile
}

func TargetTypeToString(t TargetType) string {
	if t == TargetTypeProject {
		return "project"
	}

	return "files"
}

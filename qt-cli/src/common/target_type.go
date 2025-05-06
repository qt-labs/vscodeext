// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package common

import "strings"

type TargetType int

const (
	TargetTypeFile TargetType = iota
	TargetTypeProject
)

func TargetTypeFromString(s string) TargetType {
	if strings.TrimSpace(strings.ToLower(s)) == "project" {
		return TargetTypeProject
	}

	return TargetTypeFile
}

func TargetTypeToString(t TargetType) string {
	if t == TargetTypeProject {
		return "project"
	}

	return "file"
}

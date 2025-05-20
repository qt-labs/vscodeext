// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package common

import "strings"

type Error struct {
	Message string `json:"message"`
	Details Issues `json:"details,omitempty"`
}

func (e Error) String() string {
	msg := e.Details.String()
	if len(msg) != 0 {
		return msg
	}

	return e.Message
}

type IssueLevel string

const (
	IssueLevelError   IssueLevel = "error"
	IssueLevelWarning IssueLevel = "warning"
)

type Issue struct {
	Level   IssueLevel `json:"level"`
	Field   string     `json:"field"`
	Message string     `json:"message"`
}

func NewErrorIssue(field, message string) *Issue {
	return &Issue{
		Level:   IssueLevelError,
		Field:   field,
		Message: message,
	}
}

func NewWarningIssue(field, message string) *Issue {
	return &Issue{
		Level:   IssueLevelWarning,
		Field:   field,
		Message: message,
	}
}

type Issues []Issue

func (issues Issues) String() string {
	all := []string{}

	for _, issue := range issues {
		all = append(all, issue.Message)
	}

	return strings.Join(all, ", ")
}

func (issues *Issues) HasError() bool {
	for _, issue := range *issues {
		if issue.Level == IssueLevelError {
			return true
		}
	}

	return false
}

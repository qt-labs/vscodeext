// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package common

import "strings"

type ErrorWithDetails struct {
	Message string        `json:"message"`
	Details []ErrorDetail `json:"details,omitempty"`
}

func (e ErrorWithDetails) Error() string {
	return e.Message
}

func (e *ErrorWithDetails) ToSingleLine(sep string) string {
	msg := e.JoinDetailMessages(sep)
	if len(msg) != 0 {
		return msg
	}

	return e.Message
}

func (e *ErrorWithDetails) JoinDetailMessages(sep string) string {
	all := []string{}

	for _, detail := range e.Details {
		all = append(all, detail.Message)
	}

	return strings.Join(all, sep)
}

type ErrorDetail struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

func (e ErrorDetail) Error() string {
	return e.Message
}

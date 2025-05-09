// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package handlers

import (
	"qtcli/common"
)

// convenients for error responses
type ErrorResponse struct {
	Error common.ErrorWithDetails `json:"error"`
}

func errorMessage(msg string) ErrorResponse {
	return ErrorResponse{
		Error: common.ErrorWithDetails{
			Message: msg,
		},
	}
}

func errorWithDetails(e common.ErrorWithDetails) ErrorResponse {
	return ErrorResponse{
		Error: e,
	}
}

// convenients for trivial response
type SimpleMsgResponse struct {
	Message string `json:"message"`
}

func message(msg string) SimpleMsgResponse {
	return SimpleMsgResponse{
		Message: msg,
	}
}

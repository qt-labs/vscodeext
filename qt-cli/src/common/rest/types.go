// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package rest

import "qtcli/common/validation"

type ErrorResponse struct {
	Error   string             `json:"error" binding:"required"`
	Details *validation.Issues `json:"details,omitempty"`
}

type StatusResponse struct {
	Status string `json:"status" binding:"required"`
}

type StatusAndIdResponse struct {
	Status string `json:"status" binding:"required"`
	Id     any    `json:"id" binding:"required"`
}

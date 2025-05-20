// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package handlers

import (
	"net/http"
	"qtcli/common"

	"github.com/gin-gonic/gin"
)

type ErrorResponse struct {
	Error   string         `json:"error"`
	Details *common.Issues `json:"details,omitempty"`
}

type StatusResponse struct {
	Status string `json:"status"`
}

// convenients
func ReplyGet[T any](c *gin.Context, data T) {
	c.JSON(http.StatusOK, data)
}

func ReplyPost[T any](c *gin.Context, data T) {
	c.JSON(http.StatusCreated, data)
}

func ReplyStatus(c *gin.Context, msg string) {
	c.JSON(http.StatusOK, StatusResponse{Status: msg})
}

func ReplyError(c *gin.Context, msg string, details *common.Issues) {
	c.JSON(http.StatusBadRequest, ErrorResponse{
		Error:   msg,
		Details: details,
	})
}

func ReplyErrorMsg(c *gin.Context, msg string) {
	c.JSON(http.StatusBadRequest, ErrorResponse{
		Error: msg,
	})
}

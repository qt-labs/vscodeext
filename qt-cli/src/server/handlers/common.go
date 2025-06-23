// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package handlers

import (
	"net/http"
	"qtcli/common"

	"github.com/gin-gonic/gin"
)

type ErrorResponse struct {
	Error   string         `json:"error" binding:"required"`
	Details *common.Issues `json:"details,omitempty"`
}

type StatusResponse struct {
	Status string `json:"status" binding:"required"`
}

type StatusAndIdResponse struct {
	Status string `json:"status" binding:"required"`
	Id     any    `json:"id" binding:"required"`
}

// convenients
func ReplyGet[T any](c *gin.Context, data T) {
	c.JSON(http.StatusOK, data)
}

func ReplyPost[T any](c *gin.Context, data T) {
	c.JSON(http.StatusCreated, data)
}

func ReplyDelete[T any](c *gin.Context, data T) {
	c.JSON(http.StatusOK, data)
}

func ReplyStatus(c *gin.Context, msg string) {
	c.JSON(http.StatusOK, StatusResponse{Status: msg})
}

func ReplyError(c *gin.Context, msg string, details *common.Issues) {
	e := ErrorResponse{Error: msg}
	if details != nil && len(*details) != 0 {
		e.Details = details
	}

	c.JSON(http.StatusBadRequest, e)
}

func ReplyErrorMsg(c *gin.Context, msg string) {
	c.JSON(http.StatusBadRequest, ErrorResponse{
		Error: msg,
	})
}

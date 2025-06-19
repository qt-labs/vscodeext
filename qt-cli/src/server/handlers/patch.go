// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package handlers

import (
	"qtcli/common"
	"qtcli/runner"
	"qtcli/util"

	"github.com/gin-gonic/gin"
)

type PatchCustomPresetRequest struct {
	Options map[string]any `json:"options"`
}

func PatchCustomPresetById(c *gin.Context) {
	var req PatchCustomPresetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		ReplyErrorMsg(c, err.Error())
		return
	}

	id := c.Param("id")
	preset, err := runner.Presets.User.FindByUniqueId(id)
	if err != nil {
		ReplyErrorMsg(c, err.Error())
		return
	}

	preset.Options = util.Merge(preset.GetOptions(), req.Options)

	f := runner.Presets.User.GetFile()
	f.Replace(preset)
	f.Save()

	ReplyPost(c, StatusAndIdResponse{
		Status: common.ServerStatusUpdated,
		Id:     preset.GetUniqueId(),
	})
}

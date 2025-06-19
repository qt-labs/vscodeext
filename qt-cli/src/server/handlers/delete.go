// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package handlers

import (
	"os"
	"qtcli/common"
	"qtcli/runner"
	"qtcli/util"
	"time"

	"github.com/gin-gonic/gin"
)

type PresetDeleteResponse struct {
	Name     string `json:"name" binding:"required"`
	PresetId string `json:"id" binding:"required"`
	Status   string `json:"status" binding:"required"`
}

func DeleteServer(c *gin.Context) {
	ReplyStatus(c, common.ServerClosing)

	go func() {
		time.Sleep(1 * time.Second)
		util.SendSigTermOrKill(os.Getpid())
	}()
}

func DeleteCustomPresetById(c *gin.Context) {
	id := c.Param("id")
	var preset common.PresetData
	var err error

	if id != "" {
		preset, err = runner.Presets.User.FindByUniqueId(id)
	} else {
		ReplyErrorMsg(c, common.ServerNoPreset)
		return
	}

	if err != nil {
		ReplyErrorMsg(c, common.ServerNoPreset)
		return
	}

	f := runner.Presets.User.GetFile()
	f.Remove(preset.Name)
	f.Save()

	// TODO: error handling in case of fail
	ReplyDelete(c, PresetDeleteResponse{
		Name:     preset.Name,
		PresetId: preset.GetUniqueId(),
		Status:   common.ServerPresetDeleted,
	})
}

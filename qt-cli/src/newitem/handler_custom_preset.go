// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package newitem

import (
	"qtcli/common/rest"
	"qtcli/common/texts"
	"qtcli/common/utils"
	"qtcli/newitem/preset"

	"github.com/gin-gonic/gin"
)

type NewCustomPresetRequest struct {
	Name     string         `json:"name" binding:"required"`
	PresetId string         `json:"presetId" binding:"required"`
	Options  map[string]any `json:"options"`
}
type NewCustomPresetResponse struct {
	Status   string `json:"status" binding:"required"`
	PresetId string `json:"presetId" binding:"required"`
}

type PatchCustomPresetRequest struct {
	Options map[string]any `json:"options"`
}

type PresetDeleteResponse struct {
	Name     string `json:"name" binding:"required"`
	PresetId string `json:"id" binding:"required"`
	Status   string `json:"status" binding:"required"`
}

func PatchCustomPresetById(c *gin.Context) {
	var req PatchCustomPresetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		rest.ReplyErrorMsg(c, err.Error())
		return
	}

	id := c.Param("id")
	preset, err := Presets.User.FindByUniqueId(id)
	if err != nil {
		rest.ReplyErrorMsg(c, err.Error())
		return
	}

	preset.Options = utils.Merge(preset.GetOptions(), req.Options)

	f := Presets.User.GetFile()
	f.Replace(preset)
	f.Save()

	rest.ReplyPost(c, rest.StatusAndIdResponse{
		Status: texts.ServerStatusUpdated,
		Id:     preset.GetUniqueId(),
	})
}

func PostCustomPreset(c *gin.Context) {
	var req NewCustomPresetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		rest.ReplyErrorMsg(c, err.Error())
		return
	}

	src, err := Presets.Any.FindByUniqueId(req.PresetId)
	if err != nil {
		rest.ReplyErrorMsg(c, err.Error())
		return
	}

	_, err = Presets.User.FindByName(req.Name)
	if err == nil {
		rest.ReplyErrorMsg(c, texts.ServerPresetAlreadyExists)
		return
	}

	// TODO: validate name - ensure not starting with '@', not special chars...
	newPreset := preset.NewPresetData(
		req.Name,
		src.GetTemplateDir(),
		utils.Merge(src.GetOptions(), req.Options),
	)

	f := Presets.User.GetFile()
	f.Add(newPreset)
	f.Save()

	rest.ReplyPost(c, rest.StatusAndIdResponse{
		Status: texts.ServerStatusCreated,
		Id:     newPreset.GetUniqueId(),
	})
}

func DeleteCustomPresetById(c *gin.Context) {
	id := c.Param("id")
	var preset preset.PresetData
	var err error

	if id != "" {
		preset, err = Presets.User.FindByUniqueId(id)
	} else {
		rest.ReplyErrorMsg(c, texts.ServerNoPreset)
		return
	}

	if err != nil {
		rest.ReplyErrorMsg(c, texts.ServerNoPreset)
		return
	}

	f := Presets.User.GetFile()
	f.Remove(preset.Name)
	f.Save()

	// TODO: error handling in case of fail
	rest.ReplyDelete(c, PresetDeleteResponse{
		Name:     preset.Name,
		PresetId: preset.GetUniqueId(),
		Status:   texts.ServerPresetDeleted,
	})
}

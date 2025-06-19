// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package handlers

import (
	"path/filepath"
	"qtcli/common"
	"qtcli/generator"
	"qtcli/runner"
	"qtcli/util"
	"strings"

	"github.com/gin-gonic/gin"
)

type NewItemRequest struct {
	Name       string         `json:"name"`
	WorkingDir string         `json:"workingDir"`
	PresetId   string         `json:"presetId"`
	Options    map[string]any `json:"options"`
}

type NewItemResponse struct {
	Type       string   `json:"type" binding:"required"`
	Files      []string `json:"files" binding:"required"`
	FilesDir   string   `json:"filesDir" binding:"required"`
	WorkingDir string   `json:"workingDir" binding:"required"`
	DryRun     bool     `json:"dryRun" binding:"required"`
}

type NewCustomPresetRequest struct {
	Name     string         `json:"name" binding:"required"`
	PresetId string         `json:"presetId" binding:"required"`
	Options  map[string]any `json:"options"`
}
type NewCustomPresetResponse struct {
	Status   string `json:"status" binding:"required"`
	PresetId string `json:"presetId" binding:"required"`
}

type PostNewItemContext struct {
	name       string
	workingDir string
	preset     common.PresetData
	dryRun     bool
}

func PreparePostItemsContext(c *gin.Context) *PostNewItemContext {
	var req NewItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		ReplyErrorMsg(c, err.Error())
		return nil
	}

	preset, err := runner.Presets.Any.FindByUniqueId(req.PresetId)
	if err != nil {
		ReplyErrorMsg(c, err.Error())
		return nil
	}

	preset.MergeOptions(req.Options)
	normalizedWorkingDir := filepath.Clean(req.WorkingDir)
	normalizedWorkingDir = filepath.ToSlash(normalizedWorkingDir)

	return &PostNewItemContext{
		name:       req.Name,
		workingDir: normalizedWorkingDir,
		preset:     preset,
		dryRun:     strings.ToLower(c.Query("dry_run")) == "true",
	}
}

func PostItems(c *gin.Context) {
	context := PreparePostItemsContext(c)
	if context == nil {
		return
	}

	result := generator.NewGenerator(context.name).
		Env(runner.GeneratorEnv).
		WorkingDir(context.workingDir).
		Preset(context.preset).
		DryRun(context.dryRun).
		Render()

	if !result.Success {
		ReplyError(c, result.Error.Message, &result.Error.Details)
		return
	}

	ReplyPost(c, NewItemResponse{
		Type:       context.preset.GetTypeName(),
		Files:      result.Data.GetOutputFilesRel(),
		FilesDir:   result.Data.GetOutputDirAbs(),
		WorkingDir: context.workingDir,
		DryRun:     context.dryRun,
	})
}

func PostItemsValidate(c *gin.Context) {
	context := PreparePostItemsContext(c)
	if context == nil {
		return
	}

	issues := generator.Validate(generator.ValidatorIn{
		Name:       context.name,
		WorkingDir: context.workingDir,
		TypeId:     context.preset.GetTypeId(),
	})

	if len(issues) != 0 {
		ReplyError(c, common.InputHasIssues, &issues)
		return
	}

	ReplyStatus(c, common.InputOkay)
}

func PostCustomPreset(c *gin.Context) {
	var req NewCustomPresetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		ReplyErrorMsg(c, err.Error())
		return
	}

	src, err := runner.Presets.Any.FindByUniqueId(req.PresetId)
	if err != nil {
		ReplyErrorMsg(c, err.Error())
		return
	}

	_, err = runner.Presets.User.FindByName(req.Name)
	if err == nil {
		ReplyErrorMsg(c, common.ServerPresetAlreadyExists)
		return
	}

	// TODO: validate name - ensure not starting with '@', not special chars...
	newPreset := common.NewPresetData(
		req.Name,
		src.GetTemplateDir(),
		util.Merge(src.GetOptions(), req.Options),
	)

	f := runner.Presets.User.GetFile()
	f.Add(newPreset)
	f.Save()

	ReplyPost(c, StatusAndIdResponse{
		Status: common.ServerStatusCreated,
		Id:     newPreset.GetUniqueId(),
	})
}

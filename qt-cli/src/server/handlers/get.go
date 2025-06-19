// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package handlers

import (
	"path"
	"qtcli/common"
	"qtcli/runner"

	"github.com/gin-gonic/gin"
)

type PresetsResponseItem struct {
	Id   string              `json:"id"`
	Name string              `json:"name"`
	Meta common.TemplateMeta `json:"meta"`
}

type PresetsResponse []PresetsResponseItem

type PresetDetailResponse struct {
	Id     string                     `json:"id"`
	Name   string                     `json:"name"`
	Meta   common.TemplateMeta        `json:"meta"`
	Prompt *common.PromptFileContents `json:"prompt,omitempty"`
}

func GetReady(c *gin.Context) {
	ReplyStatus(c, "ready")
}

func GetPresetsByNameOrType(c *gin.Context) {
	name := c.Query("name")
	if len(name) != 0 {
		getPresetBy(c, name, "name")
		return
	}

	var presets []common.PresetData
	type_s := c.DefaultQuery("type", "")

	if len(type_s) == 0 {
		presets = runner.Presets.Any.GetAll()
	} else {
		type_enum := common.TargetTypeFromString(type_s)
		presets = runner.Presets.Any.FindByType(type_enum)
	}

	if len(presets) == 0 {
		ReplyErrorMsg(c, common.ServerNoPresets)
		return
	}

	res := PresetsResponse{}
	for _, p := range presets {
		template, err := common.OpenTemplateFileIn(
			runner.GeneratorEnv.FS, p.GetTemplateDir())

		if err != nil {
			ReplyErrorMsg(c, common.ServerNoTemplateFile)
			return
		}

		res = append(res, PresetsResponseItem{
			Id:   p.GetUniqueId(),
			Name: p.GetName(),
			Meta: template.GetMeta(),
		})
	}

	ReplyGet(c, res)
}

func GetPresetById(c *gin.Context) {
	getPresetBy(c, c.Param("id"), "id")
}

// helpers
func getPresetBy(c *gin.Context, value, by string) {
	var p common.PresetData
	var err error

	if by == "id" {
		p, err = runner.Presets.Any.FindByUniqueId(value)
	} else {
		p, err = runner.Presets.Any.FindByName(value)
	}

	if err != nil {
		ReplyErrorMsg(c, common.ServerNoPreset)
		return
	}

	template, err := common.OpenTemplateFileIn(
		runner.GeneratorEnv.FS, p.GetTemplateDir())
	if err != nil {
		ReplyErrorMsg(c, common.ServerNoTemplateFile)
		return
	}

	prompt := getPromptFileContents(p.GetTemplateDir())
	if prompt != nil {
		prompt.UpdateDefaultValues(p.GetOptions())
	}

	ReplyGet(c, PresetDetailResponse{
		Id:     p.GetUniqueId(),
		Name:   p.GetName(),
		Meta:   template.GetMeta(),
		Prompt: prompt,
	})
}

func getPromptFileContents(dir string) *common.PromptFileContents {
	// note,
	// the absence of prompt definition isn't considered as an error
	// it means there is nothing to ask to the user.
	fullPath := path.Join(dir, common.PromptFileName)
	promptFile := common.NewPromptFileFS(runner.GeneratorEnv.FS, fullPath)

	if err := promptFile.Open(); err == nil {
		return promptFile.GetContents()
	}

	return nil
}

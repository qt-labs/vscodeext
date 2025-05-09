// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package handlers

import (
	"net/http"
	"path"
	"qtcli/common"
	"qtcli/runner"

	"github.com/gin-gonic/gin"
)

type PresetResponse struct {
	Id   string              `json:"id"`
	Name string              `json:"name"`
	Meta common.TemplateMeta `json:"meta"`
}

type PresetDetailsResponse struct {
	Id     string                     `json:"id"`
	Name   string                     `json:"name"`
	Meta   common.TemplateMeta        `json:"meta"`
	Prompt *common.PromptFileContents `json:"prompt,omitempty"`
}

func GetPresets(c *gin.Context) {
	var presets []common.PresetData
	type_s := c.DefaultQuery("type", "")

	if len(type_s) == 0 {
		presets = runner.Presets.Any.GetAll()
	} else {
		type_enum := common.TargetTypeFromString(type_s)
		presets = runner.Presets.Any.FindByType(type_enum)
	}

	if len(presets) == 0 {
		c.JSON(http.StatusBadRequest, errorMessage("could not find any preset"))
		return
	}

	res := []PresetResponse{}
	for _, p := range presets {
		template, err := common.OpenTemplateFileIn(
			runner.GeneratorEnv.FS, p.GetTemplateDir())

		if err != nil {
			c.JSON(http.StatusBadRequest,
				errorMessage("could not open template file"))
			return
		}

		res = append(res, PresetResponse{
			Id:   p.GetUniqueId(),
			Name: p.GetName(),
			Meta: template.GetMeta(),
		})
	}

	c.JSON(http.StatusOK, res)
}

func GetPresetById(c *gin.Context) {
	id := c.Param("id")
	p, err := runner.Presets.Any.FindByUniqueId(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, errorMessage("could not find any preset"))
		return
	}

	template, err := common.OpenTemplateFileIn(
		runner.GeneratorEnv.FS, p.GetTemplateDir())
	if err != nil {
		c.JSON(http.StatusBadRequest,
			errorMessage("could not open template file"))
		return
	}

	c.JSON(http.StatusOK, PresetDetailsResponse{
		Id:     p.GetUniqueId(),
		Name:   p.GetName(),
		Meta:   template.GetMeta(),
		Prompt: getPromptFileContents(p.GetTemplateDir()),
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

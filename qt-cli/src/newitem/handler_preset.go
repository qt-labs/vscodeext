// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package newitem

import (
	"path"
	"qtcli/common/rest"
	"qtcli/common/texts"
	"qtcli/newitem/preset"

	"github.com/gin-gonic/gin"
)

// presets
type PresetsResponseItem struct {
	Id          string              `json:"id"`
	Name        string              `json:"name"`
	TemplateDir string              `json:"template"`
	Meta        preset.TemplateMeta `json:"meta"`
}

type PresetsResponse []PresetsResponseItem

type PresetDetailResponse struct {
	Id          string                     `json:"id"`
	Name        string                     `json:"name"`
	TemplateDir string                     `json:"template"`
	Meta        preset.TemplateMeta        `json:"meta"`
	Prompt      *preset.PromptFileContents `json:"prompt,omitempty"`
}

func GetPresetsByNameOrType(c *gin.Context) {
	name := c.Query("name")
	if len(name) != 0 {
		getPresetBy(c, name, "name")
		return
	}

	var presets []preset.PresetData
	type_s := c.DefaultQuery("type", "")

	if len(type_s) == 0 {
		presets = Presets.Any.GetAll()
	} else {
		type_enum := preset.TargetTypeFromString(type_s)
		presets = Presets.Any.FindByType(type_enum)
	}

	if len(presets) == 0 {
		rest.ReplyErrorMsg(c, texts.ServerNoPresets)
		return
	}

	res := PresetsResponse{}
	for _, p := range presets {
		template, err := preset.OpenTemplateFileIn(
			GeneratorEnv.FS, p.GetTemplateDir())

		if err != nil {
			rest.ReplyErrorMsg(c, texts.ServerNoTemplateFile)
			return
		}

		res = append(res, PresetsResponseItem{
			Id:          p.GetUniqueId(),
			Name:        p.GetName(),
			TemplateDir: p.GetTemplateDir(),
			Meta:        template.GetMeta(),
		})
	}

	rest.ReplyGet(c, res)
}

func GetPresetById(c *gin.Context) {
	getPresetBy(c, c.Param("id"), "id")
}

// helpers
func getPresetBy(c *gin.Context, value, by string) {
	var p preset.PresetData
	var err error

	if by == "id" {
		p, err = Presets.Any.FindByUniqueId(value)
	} else {
		p, err = Presets.Any.FindByName(value)
	}

	if err != nil {
		rest.ReplyErrorMsg(c, texts.ServerNoPreset)
		return
	}

	template, err := preset.OpenTemplateFileIn(
		GeneratorEnv.FS, p.GetTemplateDir())
	if err != nil {
		rest.ReplyErrorMsg(c, texts.ServerNoTemplateFile)
		return
	}

	prompt := getPromptFileContents(p.GetTemplateDir())
	if prompt != nil {
		prompt.UpdateDefaultValues(p.GetOptions())
	}

	rest.ReplyGet(c, PresetDetailResponse{
		Id:          p.GetUniqueId(),
		Name:        p.GetName(),
		TemplateDir: p.GetTemplateDir(),
		Meta:        template.GetMeta(),
		Prompt:      prompt,
	})
}

func getPromptFileContents(dir string) *preset.PromptFileContents {
	// note,
	// the absence of prompt definition isn't considered as an error
	// it means there is nothing to ask to the user.
	fullPath := path.Join(dir, preset.PromptFileName)
	promptFile := preset.NewPromptFileFS(GeneratorEnv.FS, fullPath)

	if err := promptFile.Open(); err == nil {
		return promptFile.GetContents()
	}

	return nil
}

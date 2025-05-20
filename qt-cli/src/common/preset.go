// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package common

import (
	"fmt"
	"qtcli/util"
	"strings"

	"gopkg.in/yaml.v3"
)

type Preset interface {
	GetName() string
	GetTypeId() TargetType
	GetTypeName() string
	GetDescription() string
	GetTemplateDir() string
	GetOptions() util.StringAnyMap
	GetUniqueId() string
}

type PresetData struct {
	Name        string            `yaml:"name"`
	TemplateDir string            `yaml:"template"`
	Options     util.StringAnyMap `yaml:"options"`

	// private fields
	uniqueId     string
	targetTypeId TargetType
}

func NewPresetData(
	name, templateDir string, options util.StringAnyMap) PresetData {
	p := PresetData{
		Name:        name,
		TemplateDir: templateDir,
		Options:     options,
	}

	p.ComputeDerivedFields()
	return p
}

func (p *PresetData) ComputeDerivedFields() {
	targetTypeId := TargetTypeFile
	templateFile, err := OpenTemplateFileIn(TemplatesFS, p.TemplateDir)
	if err == nil {
		targetTypeId = templateFile.GetTargetType()
	}

	p.targetTypeId = targetTypeId
	p.uniqueId = util.CreatePresetUniqueId(p.Name)
}

func (p PresetData) GetName() string {
	return p.Name
}

func (p PresetData) GetTypeId() TargetType {
	return p.targetTypeId
}

func (p PresetData) GetTypeName() string {
	return TargetTypeToString(p.GetTypeId())
}

func (p PresetData) GetDescription() string {
	if strings.HasPrefix(p.Name, "@") {
		return fmt.Sprintf("[Default] %s", p.Name)
	} else {
		return fmt.Sprintf("%s (-> @%s)", p.Name, p.TemplateDir)
	}
}

func (p PresetData) GetTemplateDir() string {
	return p.TemplateDir
}

func (p PresetData) GetOptions() util.StringAnyMap {
	return p.Options
}

func (p PresetData) GetUniqueId() string {
	return p.uniqueId
}

func (item PresetData) ToYaml() string {
	output, err := yaml.Marshal(item)
	if err != nil {
		return ""
	}

	return string(output)
}

func (p *PresetData) MergeOptions(data util.StringAnyMap) {
	p.Options = util.Merge(p.Options, data)
}

// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package common

import (
	"qtcli/util"

	"gopkg.in/yaml.v3"
)

type Preset interface {
	GetName() string
	GetTypeId() TargetType
	GetDescription() string
	GetTemplateDir() string
	GetOptions() util.StringAnyMap
}

type PresetData struct {
	Name        string            `yaml:"name"`
	TypeName    string            `yaml:"type"`
	TemplateDir string            `yaml:"template"`
	Options     util.StringAnyMap `yaml:"options"`
}

func (p PresetData) GetName() string {
	return p.Name
}

func (p PresetData) GetTypeId() TargetType {
	return TargetTypeFromString(p.TypeName)
}

func (p PresetData) GetDescription() string {
	return p.TemplateDir
}

func (p PresetData) GetTemplateDir() string {
	return p.TemplateDir
}

func (p PresetData) GetOptions() util.StringAnyMap {
	return p.Options
}

func (item PresetData) ToYaml() string {
	output, err := yaml.Marshal(item)
	if err != nil {
		return ""
	}

	return string(output)
}

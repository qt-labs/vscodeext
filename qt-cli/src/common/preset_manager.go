// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package common

import (
	"fmt"
	"qtcli/util"
)

type PresetManager interface {
	GetAll() []PresetData
	FindByType(t TargetType) []PresetData
	FindByName(name string) (PresetData, error)
	FindByTypeAndName(t TargetType, name string) (PresetData, error)
	FindByUniqueId(id string) (PresetData, error)
}

type CompositePresetManager struct {
	comps []PresetManager
}

func NewCompositePresetManager(comps ...PresetManager) CompositePresetManager {
	return CompositePresetManager{comps: comps}
}

func (m CompositePresetManager) GetAll() []PresetData {
	all := []PresetData{}

	for _, c := range m.comps {
		all = append(all, c.GetAll()...)
	}

	return all
}

func (m CompositePresetManager) FindByType(t TargetType) []PresetData {
	all := []PresetData{}

	for _, c := range m.comps {
		all = append(all, c.FindByType(t)...)
	}

	return all
}

func (m CompositePresetManager) FindByName(name string) (PresetData, error) {
	for _, c := range m.comps {
		preset, err := c.FindByName(name)
		if err == nil {
			return preset, nil
		}
	}

	return notFoundError(name)
}

func (m CompositePresetManager) FindByTypeAndName(
	t TargetType,
	name string,
) (PresetData, error) {
	for _, c := range m.comps {
		preset, err := FindByTypeAndName(c, t, name)
		if err == nil {
			return preset, nil
		}
	}

	return notFoundError(name)
}

func (m CompositePresetManager) FindByUniqueId(id string) (PresetData, error) {
	for _, c := range m.comps {
		preset, err := c.FindByUniqueId(id)
		if err == nil {
			return preset, nil
		}
	}

	return notFoundError(id)
}

// helpers
func FindByTypeAndName(
	m PresetManager,
	t TargetType,
	name string,
) (PresetData, error) {
	candidate, err := m.FindByName(name)
	if err == nil && candidate.GetTypeId() == t {
		return candidate, nil
	}

	return notFoundError(name)
}

func notFoundError(name string) (PresetData, error) {
	return PresetData{}, fmt.Errorf(util.Msg("not found, given = '%v'"), name)
}

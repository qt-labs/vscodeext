// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package common

type UserPresetManager struct {
	file *UserPresetFile
}

func NewUserPresetManager(f *UserPresetFile) UserPresetManager {
	return UserPresetManager{file: f}
}

func (m UserPresetManager) GetAll() []PresetData {
	return m.file.GetAll()
}

func (m UserPresetManager) FindByType(t TargetType) []PresetData {
	return m.file.GetItemsOfTargetType(t)
}

func (m UserPresetManager) FindByName(name string) (PresetData, error) {
	return m.file.FindByName(name)
}

func (m UserPresetManager) FindByTypeAndName(
	t TargetType,
	name string,
) (PresetData, error) {
	return FindByTypeAndName(m, t, name)
}

func (m UserPresetManager) FindByUniqueId(id string) (PresetData, error) {
	return m.file.FindByUniqueId(id)
}

func (m UserPresetManager) GetFile() *UserPresetFile {
	return m.file
}

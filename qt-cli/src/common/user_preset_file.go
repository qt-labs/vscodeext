// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package common

import (
	"fmt"
	"os"
	"qtcli/util"

	"github.com/sirupsen/logrus"
	"gopkg.in/yaml.v3"
)

type UserPresetFile struct {
	filePath string
	contents UserPresetFileContents
}

type UserPresetFileContents struct {
	Version string       `yaml:"version"`
	Items   []PresetData `yaml:"items"`
}

func NewUserPresetFile(filePath string) *UserPresetFile {
	return &UserPresetFile{
		filePath: filePath,
	}
}

func (f *UserPresetFile) Open() error {
	logrus.Debug(fmt.Sprintf(
		"reading user presets, file = '%v'", f.filePath))

	if len(f.filePath) == 0 {
		return fmt.Errorf(
			"internal error: cannot create a preset file, invalid path")
	}

	if !util.EntryExists(f.filePath) {
		f.contents.Version = "1"
		f.contents.Items = []PresetData{}
		err := f.Save()
		if err != nil {
			return err
		}
	}

	raw, err := os.ReadFile(f.filePath)
	if err != nil {
		return err
	}

	err = yaml.Unmarshal(raw, &f.contents)
	if err != nil {
		return err
	}

	for i := range f.contents.Items {
		f.contents.Items[i].ComputeDerivedFields()
	}

	return nil
}

func (f *UserPresetFile) FindByUniqueId(id string) (PresetData, error) {
	for _, item := range f.contents.Items {
		if item.GetUniqueId() == id {
			return item, nil
		}
	}

	return PresetData{},
		fmt.Errorf(util.Msg("not found, given = '%v'"), id)
}

func (f *UserPresetFile) FindByName(name string) (PresetData, error) {
	for _, item := range f.contents.Items {
		if item.Name == name {
			return item, nil
		}
	}

	return PresetData{},
		fmt.Errorf(util.Msg("not found, given = '%v'"), name)
}

func (f *UserPresetFile) Contains(name string) bool {
	for _, item := range f.contents.Items {
		if item.Name == name {
			return true
		}
	}

	return false
}

func (f *UserPresetFile) GetFilePath() string {
	return f.filePath
}

func (f *UserPresetFile) GetCount() int {
	return len(f.contents.Items)
}

func (f *UserPresetFile) GetAllNames() []string {
	all := []string{}

	for _, item := range f.contents.Items {
		all = append(all, item.Name)
	}

	return all
}

func (f *UserPresetFile) GetAll() []PresetData {
	return f.contents.Items
}

func (f *UserPresetFile) GetItemsOfTargetType(
	t TargetType) []PresetData {
	found := []PresetData{}

	for _, item := range f.contents.Items {
		if t == item.GetTypeId() {
			found = append(found, item)
		}
	}

	return found
}

func (f *UserPresetFile) Add(data PresetData) error {
	f.contents.Items = append(f.contents.Items, data)
	return nil
}

func (f *UserPresetFile) Save() error {
	output, err := yaml.Marshal(f.contents)
	if err != nil {
		return err
	}

	_, err = util.WriteAll([]byte(output), f.filePath)
	if err != nil {
		return err
	}

	return nil
}

func (f *UserPresetFile) Replace(data PresetData) error {
	if err := f.Remove(data.Name); err != nil {
		return err
	}

	return f.Add(data)
}

func (f *UserPresetFile) Remove(name string) error {
	var found = -1

	for index, item := range f.contents.Items {
		if item.Name == name {
			found = index
			break
		}
	}

	if found < 0 {
		return fmt.Errorf(util.Msg("not found, given = '%v'"), name)
	}

	f.contents.Items = append(
		f.contents.Items[:found],
		f.contents.Items[found+1:]...,
	)

	return nil
}

func (f *UserPresetFile) RemoveAll() {
	f.contents.Items = []PresetData{}
}

func (f *UserPresetFile) Find(
	t TargetType, name string) (PresetData, error) {
	for _, item := range f.contents.Items {
		if item.Name == name && t == item.GetTypeId() {
			return item, nil
		}
	}

	return PresetData{},
		fmt.Errorf(util.Msg("not found, given = '%v'"), name)
}

func (f *UserPresetFile) Rename(from string, to string) error {
	src, err := f.FindByName(from)
	if err != nil {
		return err
	}

	_, err = f.FindByName(to)
	if err == nil {
		return fmt.Errorf(
			util.Msg("cannot rename, already exist, given = '%v'"), to)
	}

	err = f.Add(NewPresetData(to, src.TemplateDir, src.Options))
	if err != nil {
		return err
	}

	return f.Remove(from)
}

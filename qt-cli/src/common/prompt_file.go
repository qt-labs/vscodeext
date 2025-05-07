// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package common

import (
	"fmt"
	"io/fs"
	"qtcli/util"

	"github.com/sirupsen/logrus"
	"gopkg.in/yaml.v3"
)

type PromptFile struct {
	fs       fs.FS
	filePath string
	contents PromptFileContents
}

type PromptFileContents struct {
	Version string              `yaml:"version"`
	Steps   []PromptStep        `yaml:"steps"`
	Consts  []util.StringAnyMap `yaml:"consts"`
}

type PromptStep struct {
	Id           string             `yaml:"id"`
	CompType     string             `yaml:"type"`
	Question     string             `yaml:"question"`
	Description  string             `yaml:"description"`
	Value        string             `yaml:"value"`
	DefaultValue interface{}        `yaml:"default"`
	When         string             `yaml:"when"`
	Items        []PromptListItem   `yaml:"items"`
	Rules        []PromptInputRules `yaml:"rules"`
}

type PromptListItem struct {
	Text        string      `yaml:"text"`
	Data        interface{} `yaml:"data"`
	Description string      `yaml:"description"`
	Checked     string      `yaml:"checked"`
}

type PromptInputRules map[string]interface{}

func NewPromptFileFS(fs fs.FS, filePath string) *PromptFile {
	return &PromptFile{
		fs:       fs,
		filePath: filePath,
	}
}

func (f *PromptFile) Open() error {
	logrus.Debug(fmt.Sprintf(
		"reading prompt definition, file = '%v'", f.filePath))

	raw, err := util.ReadAllFromFS(f.fs, f.filePath)
	if err != nil {
		return err
	}

	err = yaml.Unmarshal(raw, &f.contents)
	if err != nil {
		return err
	}

	return nil
}

func (f *PromptFile) ExtractDefaults() util.StringAnyMap {
	all := util.StringAnyMap{}

	for _, step := range f.contents.Steps {
		all[step.Id] = step.DefaultValue
	}

	for _, e := range f.contents.Consts {
		all = util.Merge(all, e)
	}

	return all
}

func (f *PromptFile) GetContents() *PromptFileContents {
	return &f.contents
}

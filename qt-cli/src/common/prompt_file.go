// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package common

import (
	"encoding/json"
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
	Version string              `yaml:"version" json:"version"`
	Steps   []PromptStep        `yaml:"steps" json:"steps"`
	Consts  []util.StringAnyMap `yaml:"consts" json:"consts"`
}

type PromptStep struct {
	Id           string             `yaml:"id" json:"id"`
	CompType     string             `yaml:"type" json:"type"`
	Question     string             `yaml:"question" json:"question"`
	Description  string             `yaml:"description" json:"description"`
	Value        string             `yaml:"value" json:"value"`
	DefaultValue interface{}        `yaml:"default" json:"default"`
	When         string             `yaml:"when" json:"when"`
	Items        []PromptListItem   `yaml:"items" json:"items"`
	Rules        []PromptInputRules `yaml:"rules" json:"rules"`
}

type PromptListItem struct {
	Text        string      `yaml:"text" json:"text"`
	Data        interface{} `yaml:"data" json:"data"`
	Description string      `yaml:"description" json:"description"`
	Checked     string      `yaml:"checked" json:"checked"`
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

func (f *PromptFile) GetContentsAsJson() ([]byte, error) {
	// TODO: simplify implementation
	// Marshal the struct into a YAML string
	// yamlData, err := yaml.Marshal(f.contents)
	// if err != nil {
	// 	return "", err
	// }

	// // Unmarshal YAML into an interface{} (can also be a map or struct)
	// var yamlMap interface{}
	// err = yaml.Unmarshal(yamlData, &yamlMap)
	// if err != nil {
	// 	return "", err
	// }

	// Marshal the interface{} (which now holds the YAML data) into a JSON string
	return json.MarshalIndent(&f.contents, "", "  ")
	// if err != nil {
	// 	return "", err
	// }

	// return string(jsonData), nil
}

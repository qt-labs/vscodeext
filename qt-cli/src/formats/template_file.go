// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package formats

import (
	"fmt"
	"io/fs"
	"qtcli/common"
	"qtcli/util"

	"github.com/sirupsen/logrus"
	"gopkg.in/yaml.v3"
)

type TemplateFile struct {
	fs       fs.FS
	filePath string
	contents TemplateFileContents
}

type TemplateFileContents struct {
	Version  string         `yaml:"version"`
	TypeName string         `yaml:"type"`
	Files    []TemplateItem `yaml:"files"`
}

type TemplateItem struct {
	In     string `yaml:"in"`
	Out    string `yaml:"out"`
	When   string `yaml:"when"`
	Bypass bool   `yaml:"bypass"`
}

func NewTemplateFileFS(fs fs.FS, filePath string) *TemplateFile {
	return &TemplateFile{
		fs:       fs,
		filePath: filePath,
	}
}

func (f *TemplateFile) Open() error {
	logrus.Debug(fmt.Sprintf(
		"reading template definition, file = '%v'", f.filePath))

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

func (f *TemplateFile) GetTypeName() string {
	return f.contents.TypeName
}

func (f *TemplateFile) GetTargetType() common.TargetType {
	return common.TargetTypeFromString(f.contents.TypeName)
}

func (f *TemplateFile) GetFileItems() []TemplateItem {
	return f.contents.Files
}

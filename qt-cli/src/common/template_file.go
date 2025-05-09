// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package common

import (
	"errors"
	"fmt"
	"io/fs"
	"path"
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
	Version string              `yaml:"version"`
	Files   []TemplateItem      `yaml:"files"`
	Fields  []util.StringAnyMap `yaml:"fields"`
	Meta    TemplateMeta        `yaml:"meta"`
}

type TemplateMeta struct {
	Type        string `yaml:"type" json:"type"`
	Title       string `yaml:"title" json:"title"`
	Description string `yaml:"description" json:"description"`
}

type TemplateItem struct {
	In     string `yaml:"in"`
	Out    string `yaml:"out"`
	When   string `yaml:"when"`
	Bypass bool   `yaml:"bypass"`
}

func OpenTemplateFile(fs fs.FS, filePath string) (*TemplateFile, error) {
	if len(filePath) == 0 {
		return nil, errors.New(util.Msg("cannot determine a file path"))
	}

	if !util.EntryExistsFS(fs, filePath) {
		return nil, fmt.Errorf(
			util.Msg("template definition does not exist, path = '%v'"), filePath)
	}

	template := TemplateFile{
		fs:       fs,
		filePath: filePath,
	}

	err := template.open()
	if err != nil {
		return nil, err
	}

	return &template, nil
}

func OpenTemplateFileIn(fs fs.FS, dir string) (*TemplateFile, error) {
	return OpenTemplateFile(fs, path.Join(dir, TemplateFileName))
}

func (f *TemplateFile) GetTypeName() string {
	return f.contents.Meta.Type
}

func (f *TemplateFile) GetTargetType() TargetType {
	return TargetTypeFromString(f.contents.Meta.Type)
}

func (f *TemplateFile) GetFileItems() []TemplateItem {
	return f.contents.Files
}

func (f *TemplateFile) GetFields() []util.StringAnyMap {
	return f.contents.Fields
}

func (f *TemplateFile) GetMeta() TemplateMeta {
	return f.contents.Meta
}

func (f *TemplateFile) open() error {
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

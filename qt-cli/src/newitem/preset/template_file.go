// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package preset

import (
	"errors"
	"fmt"
	"io/fs"
	"path"
	"qtcli/common/utils"

	"github.com/sirupsen/logrus"
	"gopkg.in/yaml.v3"
)

type TemplateFile struct {
	fs       fs.FS
	filePath string
	contents TemplateFileContents
}

type TemplateFileContents struct {
	Version string               `yaml:"version"`
	Files   []TemplateItem       `yaml:"files"`
	Fields  []utils.StringAnyMap `yaml:"fields"`
	Meta    TemplateMeta         `yaml:"meta"`
	Options TemplateOptions      `yaml:"options"`
}

type TemplateMeta struct {
	Type        string `yaml:"type" json:"type"`
	Title       string `yaml:"title" json:"title"`
	Description string `yaml:"description" json:"description"`
}

type TemplateOptions struct {
	Polish TemplatePolishOptions `yaml:"polish"`
}

type TemplatePolishOptions struct {
	TrimStart          *bool `yaml:"trimStart"`
	CompressEmptyLines *bool `yaml:"compressEmptyLines"`
}

type TemplateItem struct {
	In     string `yaml:"in"`
	Out    string `yaml:"out"`
	When   string `yaml:"when"`
	Bypass bool   `yaml:"bypass"`
}

func OpenTemplateFile(fs fs.FS, filePath string) (*TemplateFile, error) {
	if len(filePath) == 0 {
		return nil, errors.New(utils.Msg("cannot determine a file path"))
	}

	if !utils.EntryExistsFS(fs, filePath) {
		return nil, fmt.Errorf(
			utils.Msg("template definition does not exist, path = '%v'"), filePath)
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

func (f *TemplateFile) GetFields() []utils.StringAnyMap {
	return f.contents.Fields
}

func (f *TemplateFile) GetMeta() TemplateMeta {
	return f.contents.Meta
}

func (f *TemplateFile) GetOptions() TemplateOptions {
	return f.contents.Options
}

func (f *TemplateFile) open() error {
	logrus.Debug(fmt.Sprintf(
		"reading template definition, file = '%v'", f.filePath))

	raw, err := utils.ReadAllFromFS(f.fs, f.filePath)
	if err != nil {
		return err
	}

	err = yaml.Unmarshal(raw, &f.contents)
	if err != nil {
		return err
	}

	f.validateOptions()
	return nil
}

func (f *TemplateFile) validateOptions() {
	o := &f.contents.Options

	if o.Polish.TrimStart == nil {
		DefaultTrimStart := true
		o.Polish.TrimStart = &DefaultTrimStart
	}

	if o.Polish.CompressEmptyLines == nil {
		DefaultCompressEmptyLines := true
		o.Polish.CompressEmptyLines = &DefaultCompressEmptyLines
	}
}

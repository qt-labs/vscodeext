// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package generator

import (
	"os"
	"path/filepath"
	"qtcli/common/texts"
	"qtcli/common/validation"
	"qtcli/newitem/preset"
	"strings"

	"github.com/go-playground/validator/v10"
)

var NameTagsOnProject = strings.Join([]string{
	validation.TagRequired,
	validation.TagSafeProjectName,
	validation.TagDirName,
	validation.NewTagWithParam(validation.TagMaxLength, "255"),
}, ",")

var NameTagsOnFile = strings.Join([]string{
	validation.TagRequired,
	validation.TagSafeFileName,
	validation.TagFileName,
	validation.NewTagWithParam(validation.TagMaxLength, "255"),
}, ",")

var WorkingDirTags = strings.Join([]string{
	validation.TagRequired,
	validation.TagAbsPath,
	validation.TagWindowsDrive,
}, ",")

const (
	FieldIdName       = "name"
	FieldIdWorkingDir = "workingdir"
)

type ValidatorIn struct {
	Name       string
	WorkingDir string
	TypeId     preset.TargetType
}

func Validate(in ValidatorIn) validation.Issues {
	in.Name = strings.TrimSpace(in.Name)
	in.WorkingDir = strings.TrimSpace(in.WorkingDir)

	all := validation.Issues{}
	v := validation.NewStringValidator().
		CustomIssueBuilder(buildIssue)

	if i := in.checkNameIssue(v); i != nil {
		all = append(all, *i)
	}

	if i := in.checkWorkingDirIssue(v); i != nil {
		all = append(all, *i)
	}

	return all
}

func (in *ValidatorIn) checkNameIssue(v *validation.StringValidator) *validation.Issue {
	var tags string = NameTagsOnFile
	project := in.TypeId == preset.TargetTypeProject
	if project {
		tags = NameTagsOnProject
	}

	if issue := v.Run(FieldIdName, in.Name, tags); issue != nil {
		return issue
	}

	if project {
		dir := filepath.Join(in.WorkingDir, in.Name)
		stat, err := os.Stat(dir)
		if err != nil || os.IsNotExist(err) {
			return nil
		}

		msg := texts.ValidatorSameFileExists
		if stat.IsDir() {
			msg = texts.ValidatorTargetFolderExists
		}

		return validation.NewErrorIssue(FieldIdName, msg+": "+dir)
	}

	return nil
}

func (in *ValidatorIn) checkWorkingDirIssue(v *validation.StringValidator) *validation.Issue {
	issue := v.Run(FieldIdWorkingDir, in.WorkingDir, WorkingDirTags)
	if issue != nil {
		return issue
	}

	stat, err := os.Stat(in.WorkingDir)
	if err != nil || os.IsNotExist(err) {
		return validation.NewWarningIssue(
			FieldIdWorkingDir,
			texts.ValidatorDirWillCreated+": "+in.WorkingDir)
	} else {
		if !stat.IsDir() {
			return validation.NewErrorIssue(
				FieldIdWorkingDir,
				texts.ValidatorDirInvalid+": "+in.WorkingDir)
		}
	}

	return nil
}

func buildIssue(
	fieldName string,
	allErrors validator.ValidationErrors) *validation.Issue {
	if len(allErrors) == 0 {
		return nil
	}

	return nil
}

// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package generator

import (
	"os"
	"path/filepath"
	"qtcli/common"
	"strings"

	"github.com/go-playground/validator/v10"
)

var NameTagsOnProject = strings.Join([]string{
	common.TagRequired,
	common.TagSafeProjectName,
	common.TagDirName,
	common.NewTagWithParam(common.TagMaxLength, "255"),
}, ",")

var NameTagsOnFile = strings.Join([]string{
	common.TagRequired,
	common.TagSafeFileName,
	common.TagFileName,
	common.NewTagWithParam(common.TagMaxLength, "255"),
}, ",")

var WorkingDirTags = strings.Join([]string{
	common.TagRequired,
	common.TagAbsPath,
	common.TagWindowsDrive,
}, ",")

const (
	FieldIdName       = "name"
	FieldIdWorkingDir = "workingdir"
)

type ValidatorIn struct {
	Name       string
	WorkingDir string
	TypeId     common.TargetType
}

func Validate(in ValidatorIn) common.Issues {
	in.Name = strings.TrimSpace(in.Name)
	in.WorkingDir = strings.TrimSpace(in.WorkingDir)

	all := common.Issues{}
	v := common.NewStringValidator().
		CustomIssueBuilder(buildIssue)

	if i := in.checkNameIssue(v); i != nil {
		all = append(all, *i)
	}

	if i := in.checkWorkingDirIssue(v); i != nil {
		all = append(all, *i)
	}

	return all
}

func (in *ValidatorIn) checkNameIssue(v *common.StringValidator) *common.Issue {
	var tags string = NameTagsOnFile
	project := in.TypeId == common.TargetTypeProject
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

		msg := common.ValidatorSameFileExists
		if stat.IsDir() {
			msg = common.ValidatorTargetFolderExists
		}

		return common.NewErrorIssue(FieldIdName, msg+": "+dir)
	}

	return nil
}

func (in *ValidatorIn) checkWorkingDirIssue(v *common.StringValidator) *common.Issue {
	issue := v.Run(FieldIdWorkingDir, in.WorkingDir, WorkingDirTags)
	if issue != nil {
		return issue
	}

	stat, err := os.Stat(in.WorkingDir)
	if err != nil || os.IsNotExist(err) {
		return common.NewWarningIssue(
			FieldIdWorkingDir,
			common.ValidatorDirWillCreated+": "+in.WorkingDir)
	} else {
		if !stat.IsDir() {
			return common.NewErrorIssue(
				FieldIdWorkingDir,
				common.ValidatorDirInvalid+": "+in.WorkingDir)
		}
	}

	return nil
}

func buildIssue(
	fieldName string,
	allErrors validator.ValidationErrors) *common.Issue {
	if len(allErrors) == 0 {
		return nil
	}

	return nil
}

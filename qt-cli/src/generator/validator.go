// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package generator

import (
	"os"
	"path/filepath"
	"qtcli/common"
	"qtcli/util"
	"strings"
)

var NameTagsOnProject = strings.Join([]string{
	common.TagRequired,
	common.TagProjectName,
	common.TagDirName,
}, ",")

var NameTagsOnFile = strings.Join([]string{
	common.TagRequired,
	common.TagFileName,
}, ",")

var WorkingDirTags = strings.Join([]string{
	common.TagRequired,
	common.TagAbsPath,
}, ",")

// in
type ValidatorIn struct {
	Name       string
	WorkingDir string
	TypeId     common.TargetType
}

// out
type ValidatorOut struct {
	Error    *common.ErrorWithDetails
	Warnings []string
}

func (o *ValidatorOut) HasError() bool {
	return o.Error != nil
}

func Validate(in ValidatorIn) ValidatorOut {
	isProject := in.TypeId == common.TargetTypeProject
	var nameTags string = NameTagsOnFile
	if isProject {
		nameTags = NameTagsOnProject
	}

	v := common.NewStringValidator()
	errorDetails := append(
		v.Run("Name", in.Name, nameTags),
		v.Run("WorkingDir", in.WorkingDir, WorkingDirTags)...,
	)

	if len(errorDetails) > 0 {
		return ValidatorOut{
			Error: &common.ErrorWithDetails{
				Message: "Input validation failed",
				Details: errorDetails,
			}}
	}

	if isProject {
		targetPath := filepath.Join(in.WorkingDir, in.Name)
		if _, err := os.Stat(targetPath); err == nil {
			errorDetails = append(errorDetails, common.ErrorDetail{
				Field:   "Name",
				Message: "target folder already exists: " + targetPath,
			})

			return ValidatorOut{
				Error: &common.ErrorWithDetails{
					Message: "Input validation failed",
					Details: errorDetails,
				}}
		}
	}

	// warning if working directory doesn't exist
	if !util.DirExists(in.WorkingDir) {
		warnings := []string{
			"working directory doesn't exist: " + in.WorkingDir,
		}

		return ValidatorOut{Warnings: warnings}
	}

	return ValidatorOut{}
}

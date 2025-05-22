// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package common

import (
	"fmt"
	"runtime"
	"testing"

	"github.com/stretchr/testify/assert"
)

type DataRecord struct {
	value string
	tag   string
	pass  bool
}

func TestValidationHelper_SingleTag(t *testing.T) {
	dataSet := []DataRecord{
		{"", TagRequired, false},
		{" ", TagRequired, true},
		{"a", TagRequired, true},

		{"abc", NewRegexTag("^ab$"), false},
		{"abc", NewRegexTag("^abc$"), true},
		{"abc", NewRegexTag("^[a-z]+$"), true},

		// dir name
		{"", TagDirName, false},
		{"abc/de", TagDirName, false},
		{"abc", TagDirName, true},
		{"abc de", TagDirName, true},

		// file name
		{"", TagFileName, false},
		{"abc/de", TagFileName, false},

		{"abc", TagFileName, true},
		{"abc de", TagFileName, true},

		// abs path
		{"", TagAbsPath, false},
		{" ", TagAbsPath, false},
		{"abc", TagAbsPath, false},
		{"abc/def", TagAbsPath, false},

		// project name
		{"", TagSafeProjectName, false},
		{" ", TagSafeProjectName, false},
		{"abc*", TagSafeProjectName, false},
		{"abc#", TagSafeProjectName, false},
		{"abc de", TagSafeProjectName, false},

		{"abc", TagSafeProjectName, true},
	}

	// additionl os-specific test data
	if runtime.GOOS == "windows" {
		dataSet = append(dataSet, []DataRecord{
			{" ", TagDirName, false},
			{"abc*", TagDirName, false},
			{" ", TagFileName, false},
			{"abc*", TagFileName, false},

			{"C:/abc", TagAbsPath, true},
			{"C:/abc/def", TagAbsPath, true},
			{"C:\\abc\\def", TagAbsPath, true},
		}...)
	} else {
		dataSet = append(dataSet, []DataRecord{
			{" ", TagDirName, true},
			{"abc*", TagDirName, true},
			{" ", TagFileName, true},
			{"abc*", TagFileName, true},

			{"/abc", TagAbsPath, true},
			{"/abc/def", TagAbsPath, true},
		}...)
	}

	runValidationTest(t, dataSet)
}

func TestValidationHelper_MultipleTag(t *testing.T) {
	tag1 := NewCombinedTags([]string{TagRequired, TagDirName, TagSafeProjectName})
	tag2 := NewCombinedTags([]string{
		TagRequired, TagDirName,
		NewRegexTag("^[A-Z]"), TagSafeProjectName})

	dataSet := []DataRecord{
		{"", tag1, false},
		{"abc ", tag1, false},
		{"abc# ", tag1, false},
		{"abc", tag1, true},

		{"abc", tag2, false},
		{"Abc", tag2, true},
	}

	runValidationTest(t, dataSet)
}

func runValidationTest(t *testing.T, dataSet []DataRecord) {
	for _, data := range dataSet {
		name := fmt.Sprintf("|%s|%s|%t|", data.value, data.tag, data.pass)
		t.Run(name, func(t *testing.T) {
			v := NewStringValidator()
			issue := v.Run("", data.value, data.tag)
			assert.Equal(t, data.pass, issue == nil, issue)
		})
	}
}

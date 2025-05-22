// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package common

import (
	"path/filepath"
	"qtcli/util"
	"regexp"
	"runtime"
	"strings"

	"github.com/go-playground/validator/v10"
)

const (
	TagRequired  = "required"
	TagMinLength = "min" // "min=5"
	TagMaxLength = "max" // "max=255"

	// custom tags
	TagMatch           = "match" // "match=^[a-z]{5,10}$"
	TagDirName         = "dirname"
	TagFileName        = "filename"
	TagAbsPath         = "abspath"
	TagSafeFileName    = "safefilename"
	TagSafeProjectName = "safeprojectname"
	TagWindowsDrive    = "windowsdrive"
)

type StringValidator struct {
	delegate           *validator.Validate
	customIssueBuilder IssueBuilder
}

type IssueBuilder func(
	fieldName string, allErrors validator.ValidationErrors) *Issue

func NewStringValidator() *StringValidator {
	v := validator.New()
	v.RegisterValidation(TagMatch, validateRegex)
	v.RegisterValidation(TagDirName, validateDirName)
	v.RegisterValidation(TagFileName, validateFileName)
	v.RegisterValidation(TagAbsPath, validateAbsPath)
	v.RegisterValidation(TagSafeFileName, validateSafeFileName)
	v.RegisterValidation(TagSafeProjectName, validateSafeProjectName)
	v.RegisterValidation(TagWindowsDrive, validateWindowsDrive)

	return &StringValidator{
		delegate:           v,
		customIssueBuilder: nil,
	}
}

func (sv *StringValidator) CustomIssueBuilder(b IssueBuilder) *StringValidator {
	sv.customIssueBuilder = b
	return sv
}

func (sv *StringValidator) Run(name, value, tag string) *Issue {
	if e := sv.delegate.Var(value, tag); e != nil {
		if errors, ok := e.(validator.ValidationErrors); ok {
			return sv.buildIssue(name, errors)
		}

		return NewErrorIssue(name, e.Error())
	}

	return nil
}

func (sv *StringValidator) buildIssue(
	fieldName string, allErrors validator.ValidationErrors) *Issue {
	if sv.customIssueBuilder != nil {
		issue := sv.customIssueBuilder(fieldName, allErrors)
		if issue != nil {
			return issue
		}
	}

	return defaultIssueBuilder(fieldName, allErrors)
}

// convenients for tag creation
func NewCombinedTags(tags []string) string {
	return strings.Join(tags, ",")
}

func NewRegexTag(pattern string) string {
	return NewTagWithParam(TagMatch, pattern)
}

func NewTagWithParam(tag, param string) string {
	return tag + "=" + param
}

// for custom validation
func validateRegex(fl validator.FieldLevel) bool {
	return runRegex(fl, fl.Param())
}

func validateFileName(fl validator.FieldLevel) bool {
	s := fl.Field().String()
	return util.IsValidFileName(s)
}

func validateDirName(fl validator.FieldLevel) bool {
	s := fl.Field().String()
	return util.IsValidDirName(s)
}

func validateWindowsDrive(fl validator.FieldLevel) bool {
	s := fl.Field().String()

	if runtime.GOOS == "windows" {
		return util.HasValidWindowsDrive(s)
	}

	return true
}

func validateAbsPath(fl validator.FieldLevel) bool {
	s := fl.Field().String()
	return filepath.IsAbs(s)
}

func validateSafeProjectName(fl validator.FieldLevel) bool {
	if !runRegex(fl, "^[a-zA-Z_][a-zA-Z0-9_-]*$") {
		return false
	}

	if runtime.GOOS == "windows" {
		return !util.IsWindowsReservedName(fl.Field().String())
	}

	return true
}

func validateSafeFileName(fl validator.FieldLevel) bool {
	if !runRegex(fl, "^[a-zA-Z_][a-zA-Z0-9_-]*(\\.[a-zA-Z0-9]+)?$") {
		return false
	}

	if runtime.GOOS == "windows" {
		return !util.IsWindowsReservedName(fl.Field().String())
	}

	return true
}

func runRegex(fl validator.FieldLevel, pattern string) bool {
	name := fl.Field().String()
	re, err := regexp.Compile(pattern)
	if err != nil {
		return false
	}

	return re.MatchString(name)
}

var TagToValidatorMessage = map[string]string{
	TagRequired:        ValidatorTagRequired,
	TagMinLength:       ValidatorTagMinLength,
	TagMaxLength:       ValidatorTagMaxLength,
	TagMatch:           ValidatorTagPattern,
	TagDirName:         ValidatorTagDirName,
	TagFileName:        ValidatorTagFileName,
	TagAbsPath:         ValidatorTagAbsPath,
	TagSafeFileName:    ValidatorTagSafeFileName,
	TagSafeProjectName: ValidatorTagSafeProjectName,
	TagWindowsDrive:    ValidatorTagWindowsDrive,
}

func defaultIssueBuilder(
	fieldName string, allErrors validator.ValidationErrors) *Issue {
	if len(allErrors) == 0 {
		return nil
	}

	firstError := allErrors[0]
	msg, ok := TagToValidatorMessage[firstError.Tag()]
	if !ok {
		msg = ValidatorInvalid
	}

	return NewErrorIssue(fieldName, msg)
}

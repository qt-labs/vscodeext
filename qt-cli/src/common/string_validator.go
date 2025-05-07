// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package common

import (
	"fmt"
	"path/filepath"
	"qtcli/util"
	"regexp"
	"strings"

	"github.com/go-playground/validator/v10"
)

const (
	TagRequired    = "required"
	TagMatch       = "match"
	TagDirName     = "dirname"
	TagFileName    = "filename"
	TagAbsPath     = "abspath"
	TagProjectName = "projectname"
)

type StringValidator struct {
	delegate     *validator.Validate
	errorBuilder ErrorBuilder
}

type ErrorBuilder func(
	ve validator.ValidationErrors, fieldName string) []ErrorDetail

func NewStringValidator() *StringValidator {
	v := validator.New()
	v.RegisterValidation(TagMatch, validateRegex)
	v.RegisterValidation(TagDirName, validateDirName)
	v.RegisterValidation(TagFileName, validateFileName)
	v.RegisterValidation(TagAbsPath, validateAbsPath)
	v.RegisterValidation(TagProjectName, validateProjectName)

	return &StringValidator{
		delegate:     v,
		errorBuilder: defaultErrorBuilder,
	}
}

func (h *StringValidator) Run(name, value, tag string) []ErrorDetail {
	if e := h.delegate.Var(value, tag); e != nil {
		if ve, ok := e.(validator.ValidationErrors); ok {
			if h.errorBuilder != nil {
				return h.errorBuilder(ve, name)
			} else {
				return defaultErrorBuilder(ve, name)
			}
		}

		return []ErrorDetail{{
			Field:   name,
			Message: e.Error(),
		}}
	}

	return nil
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

func validateAbsPath(fl validator.FieldLevel) bool {
	s := fl.Field().String()
	return filepath.IsAbs(s)
}

func validateProjectName(fl validator.FieldLevel) bool {
	return runRegex(fl, "^[a-zA-Z_][a-zA-Z0-9_-]*$")
}

func runRegex(fl validator.FieldLevel, pattern string) bool {
	name := fl.Field().String()
	re, err := regexp.Compile(pattern)
	if err != nil {
		return false
	}

	return re.MatchString(name)
}

func defaultErrorBuilder(
	ve validator.ValidationErrors, fieldName string) []ErrorDetail {
	var all []ErrorDetail

	for _, ve := range ve {
		msg := ""

		switch ve.Tag() {
		case TagRequired:
			msg = fmt.Sprintf("%s is required", fieldName)
		case TagMatch:
			msg = fmt.Sprintf("%s doesn't match the required pattern", fieldName)
		case TagDirName:
			msg = fmt.Sprintf("%s must be a valid directory name", fieldName)
		case TagFileName:
			msg = fmt.Sprintf("%s must be a valid file name", fieldName)
		case TagAbsPath:
			msg = fmt.Sprintf("%s must be an absolute path", fieldName)
		case TagProjectName:
			msg = fmt.Sprintf("%s must be a valid project name", fieldName)
		default:
			msg = fmt.Sprintf("%s is invalid (%s)", fieldName, ve.Tag())
		}

		all = append(all, ErrorDetail{
			Field:   fieldName,
			Message: msg + fmt.Sprintf(": %s", ve.Value()),
		})
	}

	return all
}

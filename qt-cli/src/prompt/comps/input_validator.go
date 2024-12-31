// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package comps

import (
	"errors"
	"fmt"
	"qtcli/util"
	"regexp"
	"strings"
)

type ValidatorRuleType string

const (
	ValidatorRuleTypeMatch    ValidatorRuleType = "Match"
	ValidatorRuleTypeRequired ValidatorRuleType = "Required"
)

func FindValidatorType(name string) ValidatorRuleType {
	aname := strings.ToLower(strings.TrimSpace(name))
	switch aname {
	case "match":
		return ValidatorRuleTypeMatch

	case "required":
		return ValidatorRuleTypeRequired

	default:
		return ""
	}
}

type ValidatorFunc func(string) error
type ValidatorRules map[ValidatorRuleType]interface{}

func CreateValidator(rules ValidatorRules) (ValidatorFunc, error) {
	all := []ValidatorFunc{}

	for atype, arg := range rules {
		fn, err := CreateValidatorUnitFunc(atype, arg)
		if fn != nil && err == nil {
			all = append(all, fn)
		}
	}

	if len(all) != 0 {
		return func(raw string) error {
			for _, f := range all {
				err := f(raw)
				if err != nil {
					return err
				}
			}

			return nil
		}, nil
	}

	return nil, nil
}

func CreateValidatorUnitFunc(
	atype ValidatorRuleType, arg interface{}) (ValidatorFunc, error) {
	switch atype {
	case ValidatorRuleTypeMatch:
		pattern, ok := arg.(string)
		if !ok {
			return nil, errors.New(
				util.Msg("invalid argument: string expected"))
		}

		re, err := regexp.Compile(pattern)
		if err != nil {
			return nil, fmt.Errorf(util.Msg("invalid pattern: '%w'"), err)
		}

		return func(raw string) error {
			if re.MatchString(raw) {
				return nil
			}
			return errors.New(
				util.Msg("input doesn't match the required pattern"))
		}, nil

	case ValidatorRuleTypeRequired:
		isRequired, ok := arg.(bool)
		if !ok {
			return nil, errors.New(
				util.Msg("invalid argument: boolean expected"))
		}

		if isRequired {
			return func(raw string) error {
				raw = strings.TrimSpace(raw)
				if len(raw) != 0 {
					return nil
				}

				return errors.New(util.Msg("input cannot be empty"))
			}, nil
		}
	}

	return nil, nil
}

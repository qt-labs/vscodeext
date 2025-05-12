// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package prompt

import (
	"qtcli/util"
)

type Result struct {
	Id    string
	Value ResultValue
	Done  bool
}

func (r Result) ValueNormalized() any {
	switch s := r.Value.(type) {
	case SelectionItem:
		return s.DataOrText()

	case Selection:
		return s.String()

	default:
		return r.Value
	}
}

func (r Result) ValueAsBool(defaultValue bool) bool {
	return util.ToBool(r.Value, defaultValue)
}

func (r Result) ValueAsSelectionItem() (SelectionItem, bool) {
	casted, ok := r.Value.(SelectionItem)
	return casted, ok
}

type ResultList []Result
type ResultMap map[string]Result
type ResultValue any

// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package prompt

import "strings"

type SelectionItem struct {
	Index int
	Text  string
	Data  any
}

type Selection []SelectionItem

func (item SelectionItem) String() string {
	dataString, ok := item.Data.(string)
	if ok {
		return dataString
	}

	return item.Text
}

func (item SelectionItem) DataOrText() any {
	if item.Data != nil {
		return item.Data
	}

	return item.Text
}

func (s Selection) String() string {
	all := []string{}

	for _, item := range s {
		all = append(all, item.String())
	}

	return strings.Join(all, ";")
}

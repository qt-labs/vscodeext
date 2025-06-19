// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package comps

import (
	"fmt"
	"io"
	"qtcli/prompt"
	"strings"

	"github.com/charmbracelet/bubbles/list"
	tea "github.com/charmbracelet/bubbletea"
)

type ListItem struct {
	text        string
	description string
	checked     bool
	checkable   bool
	data        any
}

func NewItem(text string) ListItem {
	return ListItem{
		text:    text,
		checked: false,
	}
}

func (i ListItem) Text(text string) ListItem {
	i.text = text
	return i
}

func (i ListItem) Description(d string) ListItem {
	i.description = d
	return i
}

func (i ListItem) Checked(c bool) ListItem {
	i.checked = c
	return i
}

func (i ListItem) Data(data any) ListItem {
	i.data = data
	return i
}

func (i *ListItem) IsSeparator() bool {
	return i.text == "-"
}

func (i ListItem) FilterValue() string {
	// a required interface to be a list.Model's item
	return ""
}

// delegate
type ListItemDelegate struct{}

func (d ListItemDelegate) Height() int {
	return 1
}

func (d ListItemDelegate) Spacing() int {
	return 0
}

func (d ListItemDelegate) Update(_ tea.Msg, _ *list.Model) tea.Cmd {
	return nil
}

func (d ListItemDelegate) Render(
	w io.Writer, m list.Model, index int, listItem list.Item) {
	item, ok := listItem.(ListItem)
	if !ok {
		return
	}

	sty := &prompt.Styles
	itemStyle := sty.ListItem.Normal

	marker := ""
	check := ""
	text := item.text
	desc := ""

	if item.IsSeparator() {
		fmt.Fprint(w, sty.ListItem.Separator.Render(
			strings.Repeat(string(prompt.MarkingSeparatorChar), 30)))
		return
	}

	if len(text) == 0 {
		text = "<None>"
	}

	if item.checkable {
		if item.checked {
			check = string(prompt.MarkingCheckBoxChecked)
			itemStyle = sty.ListItem.Selected
		} else {
			check = string(prompt.MarkingCheckBoxEmpty)
		}
	}

	if index == m.Index() {
		marker = string(prompt.MarkingItemArrow)
		itemStyle = sty.ListItem.Current
	}

	if len(item.description) != 0 {
		desc = sty.Description.Render(" (" + item.description + ")")
	}

	composed := marker + check + text
	fmt.Fprint(w, itemStyle.Render(composed)+desc)
}

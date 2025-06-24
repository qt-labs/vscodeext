// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package comps

import (
	"qtcli/prompt"

	"github.com/charmbracelet/bubbles/list"
	tea "github.com/charmbracelet/bubbletea"
)

type ListPrompt struct {
	compType    prompt.CompType
	id          string
	question    string
	help        string
	items       []ListItem
	initIndex   int
	multiSelect bool
}

func (p *ListPrompt) Id(id string) *ListPrompt {
	p.id = id
	return p
}

func (p *ListPrompt) Question(q string) *ListPrompt {
	p.question = q
	return p
}

func (p *ListPrompt) Help(h string) *ListPrompt {
	p.help = h
	return p
}

func (p *ListPrompt) Items(items []ListItem) *ListPrompt {
	p.items = items
	return p
}

func (p *ListPrompt) InitIndex(i int) *ListPrompt {
	p.initIndex = i
	return p
}

func (p *ListPrompt) SetCheckedAll(checked bool) {
	for index := range p.items {
		p.items[index].checked = checked
	}
}

func (p *ListPrompt) SetChecked(index int, checked bool) {
	if 0 <= index && index <= (len(p.items)-1) {
		p.items[index].checked = checked
	}
}

// prompt interface
func (p *ListPrompt) GetId() string {
	return p.id
}

func (p *ListPrompt) Run() (prompt.Result, error) {
	const listWidth = 50
	var count = len(p.items)

	items := []list.Item{}
	for _, item := range p.items {
		item.checkable = p.multiSelect
		items = append(items, item)
	}

	l := list.New(items, ListItemDelegate{}, listWidth, count)
	l.SetShowTitle(false)
	l.SetShowHelp(false)
	l.SetShowStatusBar(false)
	l.SetFilteringEnabled(false)
	l.SetShowPagination(false)
	l.InfiniteScrolling = true

	if p.initIndex >= 0 && p.initIndex < count {
		l.Select(p.initIndex)
	}

	init := ListModel{
		done:          false,
		prompt:        p,
		internalModel: l,
		selection:     prompt.Selection{},
	}

	final, err := tea.NewProgram(init).Run()
	if err != nil {
		return prompt.Result{}, err
	}

	model, _ := final.(ListModel)

	var value prompt.ResultValue
	if p.compType == prompt.CompTypePicker {
		if len(model.selection) == 0 {
			value = prompt.SelectionItem{}
		} else {
			value = model.selection[0]
		}
	} else {
		value = model.selection
	}

	return prompt.Result{
		Id:    p.GetId(),
		Value: value,
		Done:  model.done,
	}, nil
}

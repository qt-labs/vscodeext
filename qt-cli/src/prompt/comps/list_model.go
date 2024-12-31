// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package comps

import (
	"qtcli/prompt"

	"github.com/charmbracelet/bubbles/list"
	tea "github.com/charmbracelet/bubbletea"
)

type ListModel struct {
	done          bool
	prompt        *ListPrompt
	internalModel list.Model
	selection     prompt.Selection
}

func (m ListModel) Init() tea.Cmd {
	return nil
}

func (m ListModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.internalModel.SetWidth(msg.Width)
		return m, nil

	case tea.KeyMsg:
		switch keypress := msg.String(); keypress {
		case " ":
			if m.prompt.multiSelect {
				i, ok := m.internalModel.SelectedItem().(ListItem)
				if ok {
					i.checked = !i.checked
					m.internalModel.SetItem(m.internalModel.Index(), i)
				}
			}

		case "enter":
			needToQuit := false

			if m.prompt.multiSelect {
				m.selection = m.createSelection()
				needToQuit = true
			} else {
				item, ok := m.internalModel.SelectedItem().(ListItem)
				if ok && !item.IsSeparator() {
					m.selection = prompt.Selection{
						prompt.SelectionItem{
							Index: m.internalModel.Index(),
							Text:  item.text,
							Data:  item.data,
						},
					}

					needToQuit = true
				}
			}

			if needToQuit {
				// clear final view by setting height to zero
				m.internalModel.SetHeight(0)
				m.done = true
				return m, tea.Quit
			}

		case "q", "ctrl+c":
			return m, tea.Quit
		}

	case error:
		return m, nil
	}

	var cmd tea.Cmd
	m.internalModel, cmd = m.internalModel.Update(msg)
	return m, cmd
}

func (m ListModel) View() string {
	sty := &prompt.Styles

	if m.done {
		result := m.selectionToResultString()

		return sty.Marker.Render(string(prompt.MarkingDone)) +
			sty.Question.Render(m.prompt.question) + " " +
			sty.InputDone.Render(result) + "\n"
	}

	helpString := ""

	if len(m.prompt.help) != 0 {
		helpString = "\n\n" + sty.Help.Render(m.prompt.help)
	}

	return sty.Marker.Render(string(prompt.MarkingQuestion)) +
		sty.Question.Render(m.prompt.question) + "\n\n" +
		m.internalModel.View() +
		helpString
}

// helpers
func (m *ListModel) createSelection() prompt.Selection {
	all := prompt.Selection{}

	for index, li := range m.internalModel.Items() {
		item, ok := li.(ListItem)

		if ok && !item.IsSeparator() && item.checked {
			all = append(all, prompt.SelectionItem{
				Index: index,
				Text:  item.text,
				Data:  item.data,
			})
		}
	}

	return all
}

func (m *ListModel) selectionToResultString() string {
	if m.prompt.compType == prompt.CompTypePicker {
		if len(m.selection) == 0 {
			return ""
		}

		return m.selection[0].String()
	}

	return m.selection.String()
}

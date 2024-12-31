// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package comps

import (
	"qtcli/prompt"
	"strings"
	"unicode"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
)

type InputModel struct {
	done          bool
	prompt        *InputPrompt
	internalModel textinput.Model
	outputBuilder func(string) string
	keyMsgHandler func(InputModel, tea.KeyMsg) (tea.Model, tea.Cmd)
}

func (model InputModel) Init() tea.Cmd {
	return textinput.Blink
}

func (model InputModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		newModel, cmd := model.keyMsgHandler(model, msg)
		if newModel != nil || cmd != nil {
			return newModel, cmd
		}

	case error:
		return model, nil
	}

	var cmd tea.Cmd
	model.internalModel, cmd = model.internalModel.Update(msg)
	return model, cmd
}

func (model InputModel) View() string {
	s := &prompt.Styles
	question := s.Question.Render(model.prompt.question)

	if model.done {
		marker := s.Marker.Render(string(prompt.MarkingDone))
		raw := model.internalModel.Value()
		ans := model.outputBuilder(raw)
		return marker + question + " " + s.InputDone.Render(ans) + "\n"
	}

	helpString := ""
	descString := ""
	errorString := ""
	marker := s.Marker.Render(string(prompt.MarkingQuestion))

	if len(model.prompt.help) != 0 {
		helpString = "\n" + s.Help.Render(model.prompt.help)
	}

	if len(model.prompt.description) != 0 {
		descString = s.Description.Render(" (" + model.prompt.description + ")")
	}

	if model.internalModel.Err != nil {
		msg := decorateErrorMsg(model.internalModel.Err.Error())
		errorString = "\n" + s.Error.Render(msg)
	}

	return marker +
		question +
		descString +
		model.internalModel.View() +
		helpString +
		errorString
}

// helpers
func decorateErrorMsg(raw string) string {
	if len(raw) > 0 {
		runes := []rune(raw)
		runes[0] = unicode.ToUpper(runes[0])
		raw = string(runes)
	}

	return string(prompt.MarkingError) + raw
}

func inputOutputBuilder(raw string) string {
	return raw
}

func inputKeyMsgHandler(model InputModel, msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch key := msg.String(); key {
	case "enter":
		if model.internalModel.Err == nil {
			model.done = true
			return model, tea.Quit
		}

	case "ctrl+c":
		return model, tea.Quit
	}

	return nil, nil
}

func confirmOutputBuilder(raw string) string {
	m := strings.ToLower(strings.TrimSpace(raw))

	if m == "y" {
		return "Yes"
	} else if m == "n" {
		return "No"
	} else {
		return ""
	}
}

func confirmKeyMsgHandler(
	model InputModel, msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch key := msg.String(); key {
	case "y", "Y":
		model.done = true
		model.internalModel.SetValue("y")
		return model, tea.Quit

	case "n", "N":
		model.done = true
		model.internalModel.SetValue("n")
		return model, tea.Quit

	case "enter":
		v := strings.ToLower(model.internalModel.Value())
		answer := ""

		if len(v) == 0 {
			answer = strings.ToLower(model.prompt.defaultValue)
		} else if v == "yes" || v == "no" {
			answer = v
		}

		if len(answer) != 0 {
			model.done = true
			model.internalModel.SetValue(answer)
			return model, tea.Quit
		}

	case "ctrl+c":
		return model, tea.Quit
	}

	return nil, nil
}

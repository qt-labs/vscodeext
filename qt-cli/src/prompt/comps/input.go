// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package comps

import (
	"qtcli/prompt"
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
)

// definition, builder
type InputValidateFunc func(string) error

type InputPrompt struct {
	compType     prompt.CompType
	id           string
	question     string
	description  string
	help         string
	value        string
	defaultValue string
	validator    func(string) error
}

func (p *InputPrompt) Id(id string) *InputPrompt {
	p.id = id
	return p
}

func (p *InputPrompt) Question(q string) *InputPrompt {
	p.question = q
	return p
}

func (p *InputPrompt) Description(desc string) *InputPrompt {
	p.description = desc
	return p
}

func (p *InputPrompt) Help(h string) *InputPrompt {
	p.help = h
	return p
}

func (p *InputPrompt) Value(v string) *InputPrompt {
	p.value = v
	return p
}

func (p *InputPrompt) DefaultValue(v string) *InputPrompt {
	p.defaultValue = v
	return p
}

func (p *InputPrompt) ValidateFunc(v InputValidateFunc) *InputPrompt {
	p.validator = v
	return p
}

// prompt interface
func (p *InputPrompt) GetId() string {
	return p.id
}

func (p *InputPrompt) Run() (prompt.Result, error) {
	ti := textinput.New()
	ti.Prompt = " "
	ti.TextStyle = prompt.Styles.InputActive
	ti.Validate = p.validator
	ti.SetValue(p.value)
	ti.Focus()

	init := InputModel{
		done:          false,
		prompt:        p,
		internalModel: ti,
		outputBuilder: inputOutputBuilder,
		keyMsgHandler: inputKeyMsgHandler,
	}

	switch p.compType {
	case prompt.CompTypeInput:
		init.internalModel.Width = 50
		init.internalModel.CharLimit = 160
		init.outputBuilder = inputOutputBuilder
		init.keyMsgHandler = inputKeyMsgHandler

	case prompt.CompTypeConfirm:
		init.internalModel.CharLimit = 1
		init.outputBuilder = confirmOutputBuilder
		init.keyMsgHandler = confirmKeyMsgHandler
	}

	final, err := tea.NewProgram(init).Run()
	if err != nil {
		return prompt.Result{}, err
	}

	model, _ := final.(InputModel)
	text := model.internalModel.Value()
	result := prompt.Result{
		Id:    p.GetId(),
		Value: text,
		Done:  model.done,
	}

	if p.compType == prompt.CompTypeConfirm {
		result.Value = true

		if !strings.HasPrefix(strings.ToLower(text), "y") {
			result.Value = false
		}
	}

	return result, nil
}

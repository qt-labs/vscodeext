// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package prompt

import (
	"qtcli/common/utils"
)

type Prompt interface {
	GetId() string
	Run() (Result, error)
}

type CompType string

const (
	CompTypeInput   CompType = "Input"
	CompTypePicker  CompType = "Picker"
	CompTypeChoices CompType = "Choices"
	CompTypeConfirm CompType = "Confirm"
)

// consts
type Marking string

const (
	MarkingQuestion        Marking = "? "
	MarkingDone            Marking = "\u2714 "
	MarkingItemArrow       Marking = "\u2192 "
	MarkingCheckBoxEmpty   Marking = "[ ]  "
	MarkingCheckBoxChecked Marking = "[x]  "
	MarkingSeparatorChar   Marking = "\u2500"
	MarkingError           Marking = "! "
)

// builders
func NewInput() *InputPrompt {
	return &InputPrompt{compType: CompTypeInput}
}

func NewConfirm() *InputPrompt {
	return &InputPrompt{compType: CompTypeConfirm}
}

func NewPicker() *ListPrompt {
	return &ListPrompt{
		compType:    CompTypePicker,
		help:        utils.Msg("Use the arrow keys to move, Enter to select."),
		multiSelect: false,
	}
}

func NewChoices() *ListPrompt {
	return &ListPrompt{
		compType: CompTypeChoices,
		help: utils.Msg(
			"Use the space key to toggle selection, Enter key to finish."),
		multiSelect: true,
	}
}

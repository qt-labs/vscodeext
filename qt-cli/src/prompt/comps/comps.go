// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package comps

import (
	"qtcli/prompt"
	"qtcli/util"
)

func NewInput() *InputPrompt {
	return &InputPrompt{compType: prompt.CompTypeInput}
}

func NewConfirm() *InputPrompt {
	return &InputPrompt{compType: prompt.CompTypeConfirm}
}

func NewPicker() *ListPrompt {
	return &ListPrompt{
		compType:    prompt.CompTypePicker,
		help:        util.Msg("Use the arrow keys to move, Enter to select."),
		multiSelect: false,
	}
}

func NewChoices() *ListPrompt {
	return &ListPrompt{
		compType: prompt.CompTypeChoices,
		help: util.Msg(
			"Use the space key to toggle selection, Enter key to finish."),
		multiSelect: true,
	}
}

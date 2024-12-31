// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package prompt

import "github.com/charmbracelet/lipgloss"

type GeneralStyles struct {
	Marker      lipgloss.Style
	Question    lipgloss.Style
	Description lipgloss.Style
	InputDone   lipgloss.Style
	InputActive lipgloss.Style
	Help        lipgloss.Style
	Error       lipgloss.Style
	ListItem    ListItemStyle
}

type ListItemStyle struct {
	Normal    lipgloss.Style
	Selected  lipgloss.Style
	Current   lipgloss.Style
	Separator lipgloss.Style
}

var Styles GeneralStyles

func init() {
	Styles = GeneralStyles{
		Marker:      lipgloss.NewStyle().Foreground(lipgloss.Color("#31be25")),
		Question:    lipgloss.NewStyle().Bold(true),
		Description: lipgloss.NewStyle().Faint(true),
		InputDone: lipgloss.
			NewStyle().
			Foreground(lipgloss.Color("#00aaaa")),
		InputActive: lipgloss.
			NewStyle().
			Foreground(lipgloss.Color("#00aaaa")),
		Help: lipgloss.NewStyle().PaddingLeft(2).Faint(true),
		Error: lipgloss.
			NewStyle().
			PaddingLeft(2).
			Foreground(lipgloss.Color("#d63cd3")),

		ListItem: ListItemStyle{
			Normal: lipgloss.NewStyle().PaddingLeft(4),
			Current: lipgloss.
				NewStyle().
				PaddingLeft(2).
				Foreground(lipgloss.Color("#00bbbb")),
			Selected: lipgloss.
				NewStyle().
				PaddingLeft(4).
				Foreground(lipgloss.Color("#008888")),
			Separator: lipgloss.NewStyle().PaddingLeft(4).Faint(true),
		},
	}
}

// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package generator

import (
	"fmt"
	"io"
	"qtcli/formats"
	"text/tabwriter"
)

type Result []ResultItem

type ResultItem struct {
	TemplateItem   formats.TemplateItem
	InputFilePath  string
	OutputFilePath string
}

func (r *Result) Print(output io.Writer) {
	w := tabwriter.NewWriter(output, 0, 0, 2, ' ', 0)

	for _, item := range *r {
		fmt.Fprintf(
			w, "%s\t->\t%s\n", item.TemplateItem.In, item.OutputFilePath)
	}

	w.Flush()
}

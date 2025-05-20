// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package generator

import (
	"fmt"
	"io"
	"qtcli/common"
	"text/tabwriter"
)

type Result struct {
	Success bool
	Data    ResultData
	Error   common.Error
}

func NewOkayResult(data ResultData) *Result {
	return &Result{
		Success: true,
		Data:    data,
	}
}

func NewErrorResult(details common.Error) *Result {
	return &Result{
		Success: false,
		Error:   details,
	}
}

func NewErrorResultFrom(err error) *Result {
	return NewErrorResult(common.Error{
		Message: err.Error(),
	})
}

type ResultData struct {
	items        []ResultItem
	workingDir   string
	outputDirAbs string
}

type ResultItem struct {
	templateItem  common.TemplateItem
	inputFileRel  string // relative to env.FS
	outputFileRel string // relative to outputDirAbs
	outputFileAbs string
}

func (r *ResultData) Print(output io.Writer) {
	w := tabwriter.NewWriter(output, 0, 0, 2, ' ', 0)

	for _, item := range r.items {
		fmt.Fprintf(
			w, "%s\t->\t%s\n", item.templateItem.In, item.outputFileRel)
	}

	w.Flush()
}

func (r *ResultData) GetOutputDirAbs() string {
	return r.outputDirAbs
}

func (r *ResultData) GetOutputFilesRel() []string {
	all := []string{}

	for _, item := range r.items {
		all = append(all, item.outputFileRel)
	}

	return all
}

// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package qmltrace

type Event struct {
	feature        EventFeature
	label          string
	details        string
	sourceLocation EventSourceLocation
	detailTypeId   int
}

type EventSourceLocation struct {
	fileName string
	line     int
	column   int
}

type SampleKind int

const (
	SampleKindGeneral SampleKind = iota
	SampleKindRangeStart
	SampleKindRangeEnd
)

type Sample struct {
	// mandatory fields
	kind       SampleKind
	timeStamp  int
	eventIndex int

	// optional fields for specific event types
	timeDuration int
	memoryAmount int
}

type Metadata struct {
	filePath  string
	version   string
	startTime int64
	endTime   int64
}

type ProfileTrace struct {
	metadata Metadata
	events   map[int]Event
	samples  []Sample
}

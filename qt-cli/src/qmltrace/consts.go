// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package qmltrace

const (
	// qmlprofileereventypes.h > enum Message
	MessageTypeEvent            = 0
	MessageTypeRangeStart       = 1
	MessageTypeRangeData        = 2
	MessageTypeRangeLocation    = 3
	MessageTypeRangeEnd         = 4
	MessageTypeComplete         = 5
	MessageTypePixmapCacheEvent = 6
	MessageTypeSceneGraphFrame  = 7
	MessageTypeMemoryAllocation = 8
	MessageTypeDebugMessage     = 9
	MessageTypeQuick3DEvent     = 10
	MessageTypeUndefined        = 0xff

	// qmlprofileereventypes.h > enum RangeType
	RangeTypePainting       = 0
	RangeTypeCompiling      = 1
	RangeTypeCreating       = 2
	RangeTypeBinding        = 3
	RangeTypeHandlingSignal = 4
	RangeTypeJavascript     = 5
	RangeTypeUndefined      = 0xff
)

const (
	// qmlprofileereventypes.h > enum MemoryType
	DetailMemoryHeapPage  = 0
	DetailMemoryLargeItem = 1
	DetailMemorySmallItem = 2
	DetailMemoryUndefined = 0xff

	// qmlprofileereventypes.h > enum EventType
	DetailEventTypeFramePaint     = 0
	DetailEventTypeMouse          = 1
	DetailEventTypeKey            = 2
	DetailEventTypeAnimationFrame = 3
	DetailEventTypeEndTrace       = 4
	DetailEventTypeStartTrace     = 5
	DetailEventTypeUndefined      = 0xff
)

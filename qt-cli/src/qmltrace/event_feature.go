// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package qmltrace

import "strings"

type EventFeature string
type EventFeatures map[EventFeature]struct{}

const (
	// qmlprofilereventtypes.h > enum EventTypeFeature
	// the string literals correspond to the lowercase inner text of
	// the <type> tag in the QTD format, and are used for mapping events to
	// features during parsing.
	EventFeatureJavaScript       EventFeature = "javascript"
	EventFeatureMemoryAllocation EventFeature = "memoryallocation"
	EventFeaturePixmapCache      EventFeature = "pixmap"
	EventFeatureSceneGraph       EventFeature = "scenegraph"
	EventFeatureAnimations       EventFeature = "animation"
	EventFeaturePainting         EventFeature = "painting"
	EventFeatureCompiling        EventFeature = "compiling"
	EventFeatureCreating         EventFeature = "creating"
	EventFeatureBinding          EventFeature = "binding"
	EventFeatureHandlingSignal   EventFeature = "handlingsignal"
	EventFeatureInputEvents      EventFeature = "input"
	EventFeatureDebugMessages    EventFeature = "debug"
	EventFeatureQuick3D          EventFeature = "quick3d"

	// synthesized events that don't have a direct mapping
	// to the original event types, but are useful for visualization and analysis.
	EventFeatureRoot      EventFeature = "root"
	EventFeatureOthers    EventFeature = "others"
	EventFeatureUndefined EventFeature = "undefined"
)

var allEventFeatures = []EventFeature{
	EventFeatureJavaScript,
	EventFeatureMemoryAllocation,
	EventFeaturePixmapCache,
	EventFeatureSceneGraph,
	EventFeatureAnimations,
	EventFeaturePainting,
	EventFeatureCompiling,
	EventFeatureCreating,
	EventFeatureBinding,
	EventFeatureHandlingSignal,
	EventFeatureInputEvents,
	EventFeatureDebugMessages,
	EventFeatureQuick3D,
	EventFeatureRoot,
	EventFeatureOthers,
}

var stringToEventFeature = func() map[string]EventFeature {
	m := make(map[string]EventFeature, len(allEventFeatures))
	for _, cat := range allEventFeatures {
		m[string(cat)] = cat
	}

	return m
}()

func findEventFeatureByName(name string) EventFeature {
	key := strings.TrimSpace(strings.ToLower(name))
	if feature, ok := stringToEventFeature[key]; ok {
		return feature
	}

	return EventFeatureUndefined
}

const (
	includeAllEventFeatures = "#all"
)

// helpers
func findEventFeature(message, rangeType, detailType int) EventFeature {
	// qmleventtype.cpp > qmlFeatureFromType()

	switch message {
	case MessageTypeEvent:
		switch detailType {
		case DetailEventTypeKey, DetailEventTypeMouse:
			return EventFeatureInputEvents

		case DetailEventTypeAnimationFrame:
			return EventFeatureAnimations

		default:
			return EventFeatureUndefined
		}

	case MessageTypePixmapCacheEvent:
		return EventFeaturePixmapCache

	case MessageTypeSceneGraphFrame:
		return EventFeatureSceneGraph

	case MessageTypeMemoryAllocation:
		return EventFeatureMemoryAllocation

	case MessageTypeDebugMessage:
		return EventFeatureDebugMessages

	case MessageTypeQuick3DEvent:
		if rangeType == int(RangeTypeUndefined) {
			return EventFeatureQuick3D
		}
	}

	// determine from the range type
	switch rangeType {
	case RangeTypePainting:
		return EventFeaturePainting

	case RangeTypeCompiling:
		return EventFeatureCompiling

	case RangeTypeCreating:
		return EventFeatureCreating

	case RangeTypeBinding:
		return EventFeatureBinding

	case RangeTypeHandlingSignal:
		return EventFeatureHandlingSignal

	case RangeTypeJavascript:
		return EventFeatureJavaScript
	}

	return EventFeatureUndefined
}

func affectsFlameGraph(feature EventFeature) bool {

	return feature == EventFeatureCompiling ||
		feature == EventFeatureCreating ||
		feature == EventFeatureBinding ||
		feature == EventFeatureHandlingSignal ||
		feature == EventFeatureJavaScript ||
		feature == EventFeatureMemoryAllocation
}

// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package qmltrace

import (
	"encoding/xml"
	"io"
	"qtcli/common/utils"
	"strings"
)

func parseQtdTrace(file io.Reader, target *ProfileTrace) error {
	decoder := xml.NewDecoder(file)
	for {
		token, err := decoder.Token()
		if err != nil {
			if err == io.EOF {
				break
			}

			return err
		}

		if el, ok := token.(xml.StartElement); ok {
			if err := readRootTag(decoder, el, target); err != nil {
				return err
			}
		}
	}

	return nil
}

func readRootTag(decoder *xml.Decoder, el xml.StartElement, target *ProfileTrace) error {
	/*
		<trace version="1.02" traceStart="4585942208" traceEnd="15785509625">
			<eventData totalTime="11199567417">
				<event index="0">...</event>
				<event index="1">...</event>
				...
			</eventData>
			<profilerDataModel>
				<range startTime="4585948750" eventIndex="0" amount="647680"/>
				<range startTime="4587475458" duration="766500" eventIndex="3"/>
				...
			</profileDataModel>
		</trace>
	*/

	switch el.Name.Local {
	case "trace":
		target.metadata.version = readAttributeLC(el, "version", "")
		target.metadata.startTime = utils.ToInt64(readAttributeLC(el, "tracestart", ""), -1)
		target.metadata.endTime = utils.ToInt64(readAttributeLC(el, "traceend", ""), -1)

	case "event":
		index, event, err := readEventTag(decoder, el)
		if err != nil || index == -1 {
			return err
		}

		target.events[index] = event

	case "range":
		samples, err := readRangeTag(decoder, el)
		if err != nil {
			return err
		}

		target.samples = append(target.samples, samples...)
	}

	return nil
}

func readEventTag(decoder *xml.Decoder, el xml.StartElement) (int, Event, error) {
	/*
		<event index="0">
			<displayname>&lt;bytecode&gt;</displayname>
			<type>MemoryAllocation</type>
			<memoryEventType>1</memoryEventType>
		</event>
		<event index="1">
			<displayname>Main.qml:0</displayname>
			<type>Compiling</type>
			<filename>qrc:/qt/qml/Main/Main.qml</filename>
			<line>0</line>
			<column>0</column>
			<details>Main.qml</details>
		</event>
		...
	*/

	index := utils.ToInt(readAttributesLC(el)["index"], -1)
	event := Event{}

	for {
		token, err := decoder.Token()
		if err != nil {
			return -1, Event{}, err
		}

		switch el := token.(type) {
		case xml.StartElement:
			tag := el.Name.Local
			innerText, err := readInnerText(decoder)
			if err != nil {
				return -1, Event{}, err
			}

			updateEventDetails(&event, tag, innerText)

		case xml.EndElement:
			if el.Name.Local == "event" {
				return index, event, nil
			}
		}
	}
}

func readRangeTag(decoder *xml.Decoder, el xml.StartElement) ([]Sample, error) {
	/*
		<profilerDataModel>
			<range startTime="4585948750" eventIndex="0" amount="647680"/>
			<range startTime="4587475458" eventIndex="3" duration="766500"/>
			...
		</profileDataModel>
	*/

	// based on QmlProfilerTraceFile::loadEvents() in the QtC source.
	// only a subset of attributes is used for the flame graph.

	attrs := readAttributesLC(el)
	base := Sample{
		timeStamp:    utils.ToInt(attrs["starttime"], -1),
		eventIndex:   utils.ToInt(attrs["eventindex"], -1),
		timeDuration: utils.ToInt(attrs["duration"], 0),
		memoryAmount: utils.ToInt(attrs["amount"], 0),
	}

	all := []Sample{}

	if base.eventIndex >= 0 && base.timeStamp > 0 {
		if base.timeDuration <= 0 {
			base.kind = SampleKindGeneral
			all = append(all, base)
		} else {
			start := base
			start.kind = SampleKindRangeStart
			end := Sample{
				kind:         SampleKindRangeEnd,
				timeStamp:    start.timeStamp + start.timeDuration,
				eventIndex:   start.eventIndex,
				timeDuration: 0,
				memoryAmount: 0,
			}

			all = append(all, start, end)
		}
	}

	for {
		token, err := decoder.Token()
		if err != nil {
			return nil, err
		}

		if el, ok := token.(xml.EndElement); ok {
			if el.Name.Local == "range" {
				return all, nil
			}
		}
	}
}

func updateEventDetails(event *Event, childTagName, childInnerText string) {
	if event == nil {
		return
	}

	// qmlprofilertracefile.cpp > loadEventTypes()
	switch strings.ToLower(childTagName) {
	case "type":
		event.feature = findEventFeatureByName(childInnerText)

	case "displayname":
		event.label = childInnerText

	case "filename":
		event.sourceLocation.fileName = childInnerText

	case "line":
		event.sourceLocation.line = utils.ToInt(childInnerText, -1)

	case "column":
		event.sourceLocation.column = utils.ToInt(childInnerText, -1)

	case "details":
		event.details = childInnerText

	case "memoryeventtype":
		event.detailTypeId = utils.ToInt(childInnerText, -1)
	}
}

// helpers
func readInnerText(decoder *xml.Decoder) (string, error) {
	var data string

	for {
		token, err := decoder.Token()
		if err != nil {
			return "", err
		}

		switch el := token.(type) {
		case xml.EndElement:
			return data, nil

		case xml.CharData:
			data = strings.TrimSpace(string(el))
		}
	}
}

func readAttributesLC(el xml.StartElement) utils.StringAnyMap {
	m := make(utils.StringAnyMap, len(el.Attr))
	for _, a := range el.Attr {
		m[strings.ToLower(a.Name.Local)] = a.Value
	}
	return m
}

func readAttributeLC(el xml.StartElement, nameLC string, fallback string) string {
	for _, a := range el.Attr {
		if strings.ToLower(a.Name.Local) == nameLC {
			return a.Value
		}
	}

	return fallback
}

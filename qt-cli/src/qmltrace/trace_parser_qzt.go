// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package qmltrace

import (
	"bytes"
	"errors"
	"io"
)

func parseQztTrace(file io.Reader, target *ProfileTrace) error {
	stacks = map[int]int{}
	decoder := QtDataDecoder{reader: file}

	magic := decoder.Bytes()
	if decoder.err != nil || string(magic) != "QMLPROFILER" {
		return errors.New("invalid magic number")
	}

	_ = decoder.Int32() // TODO: reflect datastreamversion
	target.metadata.startTime = decoder.Int64()
	target.metadata.endTime = decoder.Int64()

	if decoder.err != nil {
		return decoder.err
	}

	// read events
	eventBytes := decoder.BytesUncompressed()
	if decoder.err != nil {
		if decoder.err == io.EOF {
			return errors.New("Unexpected EOF while reading events")
		}

		return decoder.err
	}

	readEvents(eventBytes, target)

	// read notes (currently unused)
	_ = decoder.BytesUncompressed()

	// read samples
	sampleBytes := decoder.BytesUncompressed()
	if decoder.err != nil {
		if decoder.err == io.EOF {
			return errors.New("Unexpected EOF while reading samples")
		}

		return decoder.err
	}

	readSamples(sampleBytes, target)
	return nil
}

func readEvents(eventBytes []byte, target *ProfileTrace) error {
	reader := bytes.NewReader(eventBytes)
	decoder := &QtDataDecoder{reader: reader}

	numEvents := decoder.Int32()
	if decoder.err != nil {
		return decoder.err
	}

	for i := range numEvents {
		event, err := readEventItem(decoder)
		if err != nil {
			return err
		}

		target.events[int(i)] = event
	}

	return nil
}

func readSamples(eventBytes []byte, target *ProfileTrace) error {
	reader := bytes.NewReader(eventBytes)

	for {
		err := readSample(reader, target)
		if err != nil {
			break
		}
	}

	return nil
}

func readEventItem(decoder *QtDataDecoder) (Event, error) {
	if decoder.err != nil {
		return Event{}, decoder.err
	}

	// qmleventtype.cpp
	// QDataStream &operator>>(QDataStream &stream, QmlEventType &type)
	ev := Event{
		label:   decoder.String(),
		details: decoder.String(),
		sourceLocation: EventSourceLocation{
			fileName: decoder.String(),
			line:     int(decoder.Int32()),
			column:   int(decoder.Int32()),
		},
	}

	message := int(decoder.Uint8())
	rangeType := int(decoder.Uint8())

	ev.detailTypeId = int(decoder.Int32())
	ev.feature = findEventFeature(message, rangeType, ev.detailTypeId)

	return ev, nil
}

var stacks = map[int]int{} // event index -> sample index in target.samples

func readSample(reader *bytes.Reader, trace *ProfileTrace) error {
	// qmlevent.cpp
	//
	// enum SerializationType {
	// 	OneByte    = 0,
	// 	TwoByte    = 1,
	// 	FourByte   = 2,
	// 	EightByte  = 3,
	// 	TypeMask   = 0x3
	// };
	//
	// enum SerializationTypeOffset {
	// 	TimestampOffset  = 0,
	// 	TypeIndexOffset  = 2,
	// 	DataLengthOffset = 4,
	// 	DataOffset       = 6
	// };

	decoder := &QtDataDecoder{reader: reader}
	types := decoder.Uint8()

	timeStamp := decoder.Int64ByQmlSizeCode(byte(types>>0) & 0x03)
	eventIndex := decoder.Int64ByQmlSizeCode(byte(types>>2) & 0x03)
	totalItems := decoder.Int64ByQmlSizeCode(byte(types>>4) & 0x03)
	itemSizeCode := byte(types>>6) & 0x03

	var items = []int64{}

	for range totalItems {
		v := decoder.Int64ByQmlSizeCode(itemSizeCode)
		if decoder.err != nil {
			break
		}

		items = append(items, v)
	}

	s := Sample{
		kind:       SampleKindGeneral,
		timeStamp:  int(timeStamp),
		eventIndex: int(eventIndex),
	}

	ev := trace.events[s.eventIndex]

	if len(items) == 1 && affectsFlameGraph(ev.feature) {
		switch items[0] {
		case MessageTypeRangeStart:
			s.kind = SampleKindRangeStart
			stacks[s.eventIndex] = len(trace.samples)
			trace.samples = append(trace.samples, s)
			return decoder.err

		case MessageTypeRangeEnd:
			s.kind = SampleKindRangeEnd

			if index, ok := stacks[s.eventIndex]; ok && index < len(trace.samples) {
				trace.samples[index].timeDuration =
					s.timeStamp - trace.samples[index].timeStamp

				delete(stacks, s.eventIndex)
			}
		}
	}

	if ev.feature == EventFeatureMemoryAllocation {
		nonHeap := (ev.detailTypeId == DetailMemoryLargeItem || ev.detailTypeId == DetailMemorySmallItem)
		if nonHeap && len(items) == 1 && items[0] > 0 {
			s.memoryAmount = int(items[0])
		}
	}

	if decoder.err == nil {
		trace.samples = append(trace.samples, s)
	}

	return decoder.err
}

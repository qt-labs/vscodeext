// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package qmltrace

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

var currentTrace = ProfileTrace{}

func GetCurrentTrace() *ProfileTrace {
	return &currentTrace
}

func LoadProfileTrace(filePath string) error {
	file, err := os.Open(filePath)
	if err != nil {
		return err
	}

	defer file.Close()

	trace := ProfileTrace{
		metadata: Metadata{filePath: filePath},
		events:   map[int]Event{},
		samples:  []Sample{},
	}

	ext := strings.ToLower(filepath.Ext(filePath))

	switch ext {
	case ".qtd":
		if err := parseQtdTrace(file, &trace); err != nil {
			return err
		}

	case ".qzt":
		if err := parseQztTrace(file, &trace); err != nil {
			return err
		}

	default:
		return fmt.Errorf("unsupported file extension: %s", ext)
	}

	sortSamplesByTime(trace.samples)
	currentTrace = trace

	return nil
}

// helpers
func sortSamplesByTime(samples []Sample) {
	sort.Slice(samples, func(i, j int) bool {
		a := &samples[i]
		b := &samples[j]

		if a.timeStamp != b.timeStamp {
			return a.timeStamp < b.timeStamp
		}

		return (a.timeStamp + a.timeDuration) > (b.timeStamp + b.timeDuration)
	})
}

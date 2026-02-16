// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package utils

import (
	"fmt"
	"hash/crc32"
	"maps"
	"math"
	"os"
	"runtime"
	"strconv"
	"strings"
	"syscall"
)

type StringAnyMap map[string]any

func Merge(base StringAnyMap, other StringAnyMap) StringAnyMap {
	all := maps.Clone(base)
	maps.Copy(all, other)
	return all
}

func ToBool(value any, defaultValue bool) bool {
	switch c := value.(type) {
	case bool:
		return c

	case string:
		{
			s := strings.TrimSpace(strings.ToLower(c))
			return s == "true" || s == "yes"
		}

	case int:
		return c != 0

	case nil:
		return false

	default:
		return defaultValue
	}
}

func ToFloat64(value any, defaultValue float64) float64 {
	switch c := value.(type) {
	case string:
		v, err := strconv.ParseFloat(c, 64)
		if err != nil {
			return defaultValue
		}

		return v

	case int:
		return float64(c)

	case nil:
		return 0.0

	default:
		return defaultValue
	}
}

func ToInt64(value any, defaultValue int64) int64 {
	switch c := value.(type) {
	case string:
		v, err := strconv.ParseInt(c, 10, 64)
		if err != nil {
			return defaultValue
		}

		return v

	case int64:
		return c

	case int:
		return int64(c)

	case float64:
		return int64(math.Round((c)))

	case nil:
		return 0

	default:
		return defaultValue
	}
}

func ToInt(value any, defaultValue int) int {
	switch c := value.(type) {
	case string:
		v, err := strconv.Atoi(c)
		if err != nil {
			return defaultValue
		}

		return v

	case int:
		return c

	case float64:
		return int(c)

	case nil:
		return 0

	default:
		return defaultValue
	}
}

func Msg(s string) string {
	return s
}

func SendSigTermOrKill(pid int) error {
	process, err := os.FindProcess(pid)
	if err != nil {
		return err
	}

	if runtime.GOOS == "windows" {
		return process.Kill()
	} else {
		return process.Signal(syscall.SIGTERM)
	}
}

func CreatePresetUniqueId(name string) string {
	return fmt.Sprintf("%010d", crc32.ChecksumIEEE([]byte(name)))
}

// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package util

import (
	"fmt"
	"io"
	"io/fs"
	"os"
	"path"
	"strconv"
	"strings"
)

type StringAnyMap map[string]interface{}

func Merge(base StringAnyMap, other StringAnyMap) StringAnyMap {
	all := StringAnyMap{}

	for k, v := range base {
		all[k] = v
	}

	for k, v := range other {
		all[k] = v
	}

	return all
}

func ReadAllFromFS(targetFS fs.FS, path string) ([]byte, error) {
	stat, err := fs.Stat(targetFS, path)
	if err != nil {
		return []byte{}, fmt.Errorf(
			Msg("cannot read file info, given = '%v'"), path)
	}

	if !stat.Mode().IsRegular() {
		return []byte{}, fmt.Errorf(
			Msg("cannot read non-regular file, given = '%v'"), path)
	}

	file, err := targetFS.Open(path)
	if err != nil {
		return []byte{}, err
	}

	defer file.Close()
	return io.ReadAll(file)
}

func WriteAll(data []byte, destPath string) (int, error) {
	dir := path.Dir(destPath)
	if err := os.MkdirAll(dir, os.ModePerm); err != nil {
		return 0, err
	}

	destFile, err := os.Create(destPath)
	if err != nil {
		return 0, err
	}

	defer destFile.Close()
	return destFile.Write(data)
}

func EntryExists(path string) bool {
	_, err := os.Stat(path)
	return !os.IsNotExist(err)
}

func EntryExistsFS(targetFS fs.FS, path string) bool {
	_, err := fs.Stat(targetFS, path)
	return !os.IsNotExist(err)
}

func ToBool(value interface{}, defaultValue bool) bool {
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

func ToFloat64(value interface{}, defaultValue float64) float64 {
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

func Msg(s string) string {
	return s
}

func IsValidDirName(name string) bool {
	tempDir := os.TempDir()
	testPath := path.Join(tempDir, name)

	err := os.Mkdir(testPath, 0755)
	if err != nil {
		return false
	}

	os.Remove(testPath)
	return true
}

func IsValidFileName(name string) bool {
	tempDir := os.TempDir()
	testPath := path.Join(tempDir, name)

	file, err := os.Create(testPath)
	if err != nil {
		return false
	}

	file.Close()
	os.Remove(testPath)
	return true
}

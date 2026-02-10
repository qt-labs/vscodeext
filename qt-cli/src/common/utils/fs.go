// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package utils

import (
	"fmt"
	"io"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strings"
)

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

func DirExists(path string) bool {
	info, err := os.Stat(path)
	if err != nil || os.IsNotExist(err) {
		return false
	}

	return info.IsDir()
}

func HasValidWindowsDrive(path string) bool {
	if len(path) < 2 || path[1] != ':' {
		return false
	}

	driveRoot := path[:2] + `\`
	info, err := os.Stat(driveRoot)
	return err == nil && info.IsDir()
}

func IsWindowsReservedName(name string) bool {
	pattern := "(?i)^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$"
	re, err := regexp.Compile(pattern)
	if err != nil {
		return false
	}

	return re.MatchString(name)
}

var multiDotRegex = regexp.MustCompile(`\.{2,}`)

func NormalizeFileExt(fileName, fallbackExt string) string {
	fileName = multiDotRegex.ReplaceAllString(fileName, ".")
	ext := filepath.Ext(fileName)
	base := strings.TrimSuffix(fileName, ext)
	if ext == "." {
		ext = ""
	}

	effectiveName := base + ext
	if fallbackExt == "" || fallbackExt == "." || ext != "" {
		return effectiveName
	}

	if !strings.HasPrefix(fallbackExt, ".") {
		fallbackExt = "." + fallbackExt
	}

	return effectiveName + fallbackExt
}

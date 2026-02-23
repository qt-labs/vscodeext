//go:build windows

// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package server

import (
	"net"
	"os"
	"path/filepath"

	"github.com/Microsoft/go-winio"
)

func getPidFilePathFrom(o Options) string {
	dir := getTempDir()
	if err := os.MkdirAll(dir, 0755); err != nil {
		return ""
	}

	return dir + `\` + getBaseName(o) + ".pid"
}

func getAllPidFiles() []string {
	pattern := getTempDir() + `\qtcli-*.pid`
	files, err := filepath.Glob(pattern)
	if err != nil {
		return []string{}
	}

	return files
}

func getLocalIpcListener(o Options) (net.Listener, error) {
	pipeName := `\\.\pipe\qtcli\` + getBaseName(o) + ".pipe"
	return winio.ListenPipe(pipeName, nil)
}

func getTempDir() string {
	return os.Getenv("LOCALAPPDATA") + `\qtcli`
}

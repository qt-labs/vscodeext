//go:build !windows

// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package server

import (
	"net"
	"os"
	"path/filepath"
)

const TempDir = "/tmp/qtcli"

func getPidFilePathFrom(o Options) string {
	if err := os.MkdirAll(TempDir, 0755); err != nil {
		return ""
	}

	return filepath.Join(TempDir, getBaseName(o)+".pid")
}

func getAllPidFiles() []string {
	pattern := "/tmp/qtcli/qtcli-*.pid"
	files, err := filepath.Glob(pattern)
	if err != nil {
		return []string{}
	}

	return files
}

func getLocalIpcListener(o Options) (net.Listener, error) {
	if err := os.MkdirAll(TempDir, 0755); err != nil {
		return nil, err
	}

	fullPath := filepath.Join(TempDir, getBaseName(o)+".sock")
	_, err := os.Stat(fullPath)
	if !os.IsNotExist(err) {
		err := os.Remove(fullPath)
		if err != nil {
			return nil, err
		}
	}

	return net.Listen("unix", fullPath)
}

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

func getPidFilePath() string {
	if err := os.MkdirAll(TempDir, 0755); err != nil {
		return ""
	}

	return filepath.Join(TempDir, "qtcli-server.pid")
}

func getLocalIpcListener() (net.Listener, error) {
	if err := os.MkdirAll(TempDir, 0755); err != nil {
		return nil, err
	}

	fullPath := filepath.Join(TempDir, "qtcli-server.sock")
	_, err := os.Stat(fullPath)
	if !os.IsNotExist(err) {
		err := os.Remove(fullPath)
		if err != nil {
			return nil, err
		}
	}

	return net.Listen("unix", fullPath)
}

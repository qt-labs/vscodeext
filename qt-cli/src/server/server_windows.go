//go:build windows

// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package server

import (
	"net"
	"os"

	"github.com/Microsoft/go-winio"
)

func getPidFilePath() string {
	dir := os.Getenv("LOCALAPPDATA") + `\qtcli`
	if err := os.MkdirAll(dir, 0755); err != nil {
		return ""
	}

	return dir + `\qtcli-server.pid`
}

func getLocalIpcListener() (net.Listener, error) {
	pipeName := `\\.\pipe\qtcli\qtcli-server.pipe`
	return winio.ListenPipe(pipeName, nil)
}

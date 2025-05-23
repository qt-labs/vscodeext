//go:build !windows

// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package server

import (
	"net"
	"os"
)

const TempDir = "/tmp/qtcli"

func getPidFilePath() string {
	if err := os.MkdirAll(TempDir, 0755); err != nil {
		return ""
	}

	return TempDir + "/qtcli-server.pid"
}

func getLocalIpcListener() (net.Listener, error) {
	if err := os.MkdirAll(TempDir, 0755); err != nil {
		return nil, err
	}

	return net.Listen("unix", TempDir+"/qtcli-server.sock")
}

//go:build !windows

// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package server

import "net"

func getPidFilePath() string {
	return "/tmp/qtcli/qtcli-server.pid"
}

func getLocalIpcListener() (net.Listener, error) {
	return net.Listen("unix", "/tmp/qtcli/qtcli-server.sock")
}

// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package main

import (
	"strconv"
	"strings"
	"time"
	"qtcli/cmds"
)

var version = "dev"
var timestamp = ""
var commit = ""

func main() {
	cmds.SetVersion(formatVersion(version, timestamp, commit))
	cmds.Execute()
}

func formatVersion(version, timestamp, commit string) string {
	info := []string{}
	unixtime, err := strconv.ParseInt(timestamp, 10, 64)
	if err == nil {
		info = append(info, time.Unix(unixtime, 0).UTC().Format(time.RFC3339))
	}

	if len(commit) > 10 {
		info = append(info, commit[:10])
	} else if len(commit) > 0 {
		info = append(info, commit)
	}

	details := strings.Join(info, ", ")
	if len(details) == 0 {
		return version
	} else {
		return version + " (" + details + ")"
	}
}

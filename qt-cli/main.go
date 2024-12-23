// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package main

import (
	"qtcli/cmd"
)

var version = "dev"

func main() {
	cmd.SetVersion(version)
	cmd.Execute()
}

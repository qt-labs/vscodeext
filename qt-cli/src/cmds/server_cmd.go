// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package cmds

import (
	"qtcli/server"
	"qtcli/util"
	"strings"

	"github.com/spf13/cobra"
)

var serverCmd = &cobra.Command{
	Use:   "server <start|stop>",
	Short: util.Msg("Start or stop a rest server"),
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		control := strings.ToLower(strings.TrimSpace(args[0]))

		if control == "start" {
			server.Start()
		} else if control == "stop" {
			server.Stop()
		} else {
			cmd.Help()
		}
	},
}

func init() {
	rootCmd.AddCommand(serverCmd)
}

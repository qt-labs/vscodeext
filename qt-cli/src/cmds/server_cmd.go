// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package cmds

import (
	"qtcli/server"
	"qtcli/util"
	"strings"

	"github.com/spf13/cobra"
)

var useTcp bool
var tcpPort string

var serverCmd = &cobra.Command{
	Use:   "server <start|stop>",
	Short: util.Msg("Start or stop a rest server"),
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		control := strings.ToLower(strings.TrimSpace(args[0]))

		if control == "start" {
			server.Start(server.Options{
				UseTcp:  useTcp,
				TcpPort: tcpPort,
			})
		} else if control == "stop" {
			server.Stop()
		} else {
			cmd.Help()
		}
	},
}

func init() {
	serverCmd.Flags().BoolVar(
		&useTcp, "tcp", false,
		util.Msg("Use TCP instead of local IPC"))

	serverCmd.Flags().StringVar(
		&tcpPort, "port", "8080",
		util.Msg("Specify TCP port (effective only when --tcp is set)"))

	rootCmd.AddCommand(serverCmd)
}

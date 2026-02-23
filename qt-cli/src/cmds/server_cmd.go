// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package cmds

import (
	"fmt"
	"qtcli/common/utils"
	"qtcli/server"
	"time"

	"github.com/spf13/cobra"
)

var useTcp bool
var tcpPort string
var udsSocketName string
var useIdleExit bool
var heartbeat time.Duration

var serverCmd = &cobra.Command{
	Use:   "server",
	Short: utils.Msg("List and manage server instances"),
	Run: func(cmd *cobra.Command, args []string) {
		cmd.Help()
	},
}

var serverListCmd = &cobra.Command{
	Use:   "ls",
	Short: utils.Msg("List all running server instances"),
	Run: func(cmd *cobra.Command, args []string) {
		for _, pidFiles := range server.GetAllPidFiles() {
			fmt.Println(pidFiles)
		}
	},
}

var serverStartCmd = &cobra.Command{
	Use:   "start",
	Short: utils.Msg("Start a server"),
	RunE: func(cmd *cobra.Command, args []string) error {
		opt := server.Options{
			UseTcp:        useTcp,
			TcpPort:       tcpPort,
			UdsSocketName: udsSocketName,
			UseIdleExit:   useIdleExit,
			Heartbeat:     heartbeat,
		}

		if err := server.ValidateOptions(opt); err != nil {
			return err
		}

		server.Start(opt)
		return nil
	},
}

var serverStopCmd = &cobra.Command{
	Use:   "stop",
	Short: utils.Msg("Stop a server"),
	Run: func(cmd *cobra.Command, args []string) {
		opt := server.Options{
			UseTcp:        useTcp,
			TcpPort:       tcpPort,
			UdsSocketName: udsSocketName,
		}

		server.Stop(opt)
	},
}

var serverStopAllCmd = &cobra.Command{
	Use:   "all",
	Short: utils.Msg("Stop all server instances"),
	Run: func(cmd *cobra.Command, args []string) {
		server.StopAll()
	},
}

func init() {
	// common flags to start and stop commands
	for _, cmd := range []*cobra.Command{serverStartCmd, serverStopCmd} {
		cmd.Flags().StringVar(
			&udsSocketName, "socket", "default",
			utils.Msg("Specify UDS socket name to use"))

		cmd.Flags().BoolVar(
			&useTcp, "tcp", false,
			utils.Msg("Use TCP instead of local IPC"))

		cmd.Flags().StringVar(
			&tcpPort, "port", "8080",
			utils.Msg("Specify TCP port (only used with --tcp)"))
	}

	serverStartCmd.Flags().BoolVar(
		&useIdleExit, "exit-on-idle", false,
		utils.Msg("Exit the server automatically after inactivity"))

	serverStartCmd.Flags().DurationVar(
		&heartbeat, "heartbeat", 10*time.Second,
		utils.Msg("Heartbeat interval for clients (used with --exit-on-idle)"))

	// commands
	serverStopCmd.AddCommand(serverStopAllCmd)

	serverCmd.AddCommand(serverListCmd)
	serverCmd.AddCommand(serverStartCmd)
	serverCmd.AddCommand(serverStopCmd)

	rootCmd.AddCommand(serverCmd)
}

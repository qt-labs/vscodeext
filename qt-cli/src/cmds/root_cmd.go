// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package cmds

import (
	"os"
	"qtcli/util"

	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
)

var verbose = false

var rootCmd = &cobra.Command{
	Use:   "qtcli",
	Short: util.Msg("A CLI for creating Qt project and files"),
	PersistentPreRun: func(cmd *cobra.Command, args []string) {
		if verbose {
			logrus.SetLevel(logrus.DebugLevel)
		}

		logrus.SetFormatter(&logrus.TextFormatter{
			ForceColors: true,
		})
	},
	Run: func(cmd *cobra.Command, args []string) {
		cmd.Help()
	},
}

func Execute() {
	err := rootCmd.Execute()
	if err != nil {
		os.Exit(1)
	}
}

func SetVersion(v string) {
	rootCmd.Version = v
}

func init() {
	rootCmd.SilenceUsage = true
	rootCmd.PersistentFlags().BoolVarP(
		&verbose, "verbose", "v", false, util.Msg("Enable verbose output"))
}

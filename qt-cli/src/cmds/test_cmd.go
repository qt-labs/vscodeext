// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package cmds

import (
	"fmt"
	"qtcli/common"
	"qtcli/runner"
	"qtcli/util"
	"strings"

	"github.com/spf13/cobra"
)

var testCmd = &cobra.Command{
	Use:   "test",
	Short: util.Msg("Test specific features"),
	Run: func(cmd *cobra.Command, args []string) {
		cmd.Help()
	},
}

var testPromptCmd = &cobra.Command{
	Use:   "prompt <default-preset-name>",
	Short: util.Msg("Run a prompt for testing purpose"),
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		if !strings.HasPrefix(args[0], "@") {
			return createNotFoundError(args[0])
		}

		name := args[0][1:]

		for _, p := range runner.FindAllDefaultPresets() {
			if p.TemplateDir == name {
				options, err := runner.RunPromptFromDir(name)
				if err != nil {
					return err
				}

				item := p.ToPresetData()
				item.Options = options
				printPreset(item)
				return nil
			}
		}

		return createNotFoundError(args[0])
	},
}

var testDefaultCmd = &cobra.Command{
	Use:   "default <default-preset-name>",
	Short: util.Msg("Display default values of a given preset"),
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		if !strings.HasPrefix(args[0], "@") {
			return createNotFoundError(args[0])
		}

		name := args[0][1:]

		for _, p := range runner.FindAllDefaultPresets() {
			if name == p.TemplateDir {
				printPreset(p.ToPresetData())
				return nil
			}
		}

		return createNotFoundError(args[0])
	},
}

func printPreset(p common.PresetData) {
	fmt.Println(strings.Repeat("-", 40))
	fmt.Println(p.ToYaml())
}

func createNotFoundError(name string) error {
	return fmt.Errorf(
		util.Msg("cannot find the given preset, name = '%s'"), name)
}

func init() {
	testCmd.AddCommand(testPromptCmd)
	testCmd.AddCommand(testDefaultCmd)
	rootCmd.AddCommand(testCmd)
}

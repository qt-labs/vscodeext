// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package cmds

import (
	"errors"
	"fmt"
	"qtcli/common"
	"qtcli/formats"
	"qtcli/prompt/comps"
	"qtcli/runner"
	"qtcli/util"
	"strings"

	"github.com/spf13/cobra"
)

var presetCmd = &cobra.Command{
	Use:   "preset",
	Short: util.Msg("Inspect and manage presets"),
	Run: func(cmd *cobra.Command, args []string) {
		cmd.Help()
	},
}

var presetListCmd = &cobra.Command{
	Use:   "ls",
	Short: util.Msg("List the names of all presets"),
	Args:  cobra.ExactArgs(0),
	Run: func(cmd *cobra.Command, args []string) {
		if userPresets().GetCount() == 0 {
			fmt.Println(util.Msg("<no custom preset>"))
		} else {
			for _, item := range userPresets().GetItems() {
				fmt.Printf("%s -> @%s\n", item.GetName(), item.GetDescription())
			}
		}

		if lsAllPresets {
			all := runner.FindAllDefaultPresets()
			for _, item := range all {
				fmt.Printf("%s (%s)\n", item.GetName(), item.GetTypeId())
			}
		}
	},
}

var presetCatCmd = &cobra.Command{
	Use:   "cat <preset-name>",
	Short: util.Msg("Print the contents of the given preset"),
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		item := common.PresetData{}
		name := args[0]

		if !strings.HasPrefix(name, "@") {
			i, err := userPresets().FindByName(name)
			if err != nil {
				return err
			}

			item = i
		} else {
			name = name[1:]

			for _, p := range runner.FindAllDefaultPresets() {
				if p.GetTemplateDir() == name {
					item = p.ToPresetData()
					break
				}
			}
		}

		if len(item.TemplateDir) != 0 {
			fmt.Println(item.ToYaml())
		}

		return nil
	},
}

var presetMoveCmd = &cobra.Command{
	Use:   "mv <from:preset-name> <to:new-preset-name>",
	Short: util.Msg("Rename a user preset"),
	Args:  cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		if !userPresets().Contains(args[0]) {
			return errors.New(util.Msg("preset not found"))
		}

		err := userPresets().Rename(args[0], args[1])
		if err != nil {
			return err
		}

		if err := userPresets().Save(); err != nil {
			return err
		}

		return nil
	},
}

var presetRemoveCmd = &cobra.Command{
	Use:   "rm <preset-name>",
	Short: util.Msg("Remove a user preset"),
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		if !userPresets().Contains(args[0]) {
			return errors.New(util.Msg("preset not found"))
		}

		msg := util.Msg("Are you sure you want to remove this preset?")
		if getConfirm(msg) {
			if err := userPresets().Remove(args[0]); err != nil {
				return err
			}

			if err := userPresets().Save(); err != nil {
				return err
			}
		}

		return nil
	},
}

var presetClearCmd = &cobra.Command{
	Use:   "clear",
	Short: util.Msg("Remove all user presets"),
	Args:  cobra.ExactArgs(0),
	RunE: func(cmd *cobra.Command, args []string) error {
		count := userPresets().GetCount()
		if count == 0 {
			return nil
		}

		msg := util.Msg("Are you sure you want to remove all presets?")
		if getConfirm(msg) {
			userPresets().RemoveAll()
			if err := userPresets().Save(); err != nil {
				return err
			}
		}

		return nil
	},
}

var lsAllPresets bool

func getConfirm(msg string) bool {
	r, _ := comps.NewConfirm().
		Question(msg).
		Description("y/N").
		DefaultValue("n").
		Run()

	return r.ValueAsBool(false)
}

func userPresets() *formats.UserPresetFile {
	return runner.AllUserPresets
}

func init() {
	presetListCmd.Flags().BoolVarP(
		&lsAllPresets, "all", "a", false,
		util.Msg("Include default presets in the list"))

	presetCmd.AddCommand(presetListCmd)
	presetCmd.AddCommand(presetCatCmd)
	presetCmd.AddCommand(presetMoveCmd)
	presetCmd.AddCommand(presetRemoveCmd)
	presetCmd.AddCommand(presetClearCmd)

	rootCmd.AddCommand(presetCmd)
}

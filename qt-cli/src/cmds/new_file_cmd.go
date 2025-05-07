// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package cmds

import (
	"fmt"
	"path"
	"qtcli/common"
	"qtcli/generator"
	"qtcli/runner"
	"qtcli/util"
	"strings"

	"github.com/spf13/cobra"
)

var newFilePresetName string

var newFileCmd = &cobra.Command{
	Use:   "new-file [file-name]",
	Short: util.Msg("Create a new file in the current directory"),
	RunE: func(cmd *cobra.Command, args []string) error {
		var name string
		var selected common.Preset
		const targetType = common.TargetTypeFile

		if len(args) == 0 {
			name = runner.RunFileNamePrompt()
			if len(name) == 0 {
				return nil
			}
		} else {
			name = args[0]
		}

		if ext := path.Ext(name); len(ext) != 0 {
			userPreset, err := runner.RunFilePromptByExt(ext)
			if err != nil {
				return err
			}

			if userPreset == nil {
				return fmt.Errorf(
					util.Msg("unknown file type, ext = '%s'"), ext)
			}

			name = strings.TrimSuffix(name, ext)
			selected = userPreset
		} else {
			var err error
			selected, err = runner.FindPresetOrRunSelector(
				targetType, newFilePresetName)
			if err != nil {
				return fmt.Errorf(
					util.Msg("failed to find or select a preset: '%w'"), err)
			}
		}

		result := generator.NewGenerator(name).
			Env(runner.GeneratorEnv).
			Preset(selected).
			Render()

		if !result.Success {
			return fmt.Errorf(
				util.Msg("failed to generate a file: '%w'"),
				result.Error.Message)

		}

		return nil
	},
}

func init() {
	newFileCmd.Flags().StringVar(
		&newFilePresetName, "preset", "",
		util.Msg("Specify a preset to use"))

	rootCmd.AddCommand(newFileCmd)
}

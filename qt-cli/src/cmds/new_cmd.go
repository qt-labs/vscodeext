// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package cmds

import (
	"fmt"
	"os"
	"path/filepath"
	"qtcli/common/utils"
	"qtcli/newitem"
	"qtcli/newitem/generator"
	"qtcli/newitem/preset"

	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
)

var newPresetName string

var newCmd = &cobra.Command{
	Use:   "new <project-name>",
	Short: utils.Msg("Create a new project under the current directory"),
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		name := args[0]
		cwd, _ := os.Getwd()
		out := generator.Validate(generator.ValidatorIn{
			Name:       name,
			WorkingDir: filepath.ToSlash(cwd),
			TypeId:     preset.TargetTypeProject,
		})

		if out.HasError() {
			return fmt.Errorf(
				utils.Msg("Cannot generate the project\n%s"), out)
		}

		const targetType = preset.TargetTypeProject
		preset, err := newitem.FindPresetOrRunSelector(targetType, newPresetName)
		if err != nil {
			return fmt.Errorf(
				utils.Msg("failed to select a preset: '%w'"), err)
		}

		result := generator.NewGenerator(name).
			Env(newitem.GeneratorEnv).
			Preset(preset).
			Render()

		if !result.Success {
			return fmt.Errorf(
				utils.Msg("failed to generate a project\n%s"),
				result.Error)
		}

		if verbose {
			result.Data.Print(logrus.New().Writer())
		}

		return nil
	},
}

func init() {
	newCmd.Flags().StringVar(
		&newPresetName, "preset", "",
		utils.Msg("Specify a preset to use"))

	rootCmd.AddCommand(newCmd)
}

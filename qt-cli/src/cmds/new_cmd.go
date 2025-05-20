// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package cmds

import (
	"fmt"
	"os"
	"path/filepath"
	"qtcli/common"
	"qtcli/generator"
	"qtcli/runner"
	"qtcli/util"

	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
)

var newPresetName string

var newCmd = &cobra.Command{
	Use:   "new <project-name>",
	Short: util.Msg("Create a new project under the current directory"),
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		name := args[0]
		cwd, _ := os.Getwd()
		out := generator.Validate(generator.ValidatorIn{
			Name:       name,
			WorkingDir: filepath.ToSlash(cwd),
			TypeId:     common.TargetTypeProject,
		})

		if out.HasError() {
			return fmt.Errorf(
				util.Msg("Cannot generate the project\n%s"), out)
		}

		const targetType = common.TargetTypeProject
		preset, err := runner.FindPresetOrRunSelector(targetType, newPresetName)
		if err != nil {
			return fmt.Errorf(
				util.Msg("failed to select a preset: '%w'"), err)
		}

		result := generator.NewGenerator(name).
			Env(runner.GeneratorEnv).
			Preset(preset).
			Render()

		if !result.Success {
			return fmt.Errorf(
				util.Msg("failed to generate a project\n%s"),
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
		util.Msg("Specify a preset to use"))

	rootCmd.AddCommand(newCmd)
}

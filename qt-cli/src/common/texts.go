// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package common

const (
	ValidatorTagRequired        = "This field is required"
	ValidatorTagMinLength       = "The input is too short"
	ValidatorTagMaxLength       = "The input is too long"
	ValidatorTagPattern         = "The input doesn't match the required pattern"
	ValidatorTagDirName         = "Enter a valid directory name"
	ValidatorTagFileName        = "Enter a valid file name"
	ValidatorTagAbsPath         = "The path must be absolute"
	ValidatorTagSafeFileName    = "Enter a valid file name"
	ValidatorTagSafeProjectName = "Enter a valid project name"
	ValidatorTagWindowsDrive    = "The drive name is invalid"

	ValidatorInvalid            = "The input is invalid"
	ValidatorSameFileExists     = "A file with the same name already exists"
	ValidatorTargetFolderExists = "The target folder already exists"
	ValidatorDirWillCreated     = "The directory will be created"
	ValidatorDirInvalid         = "The directory path is invalid"

	InputOkay      = "Input validation passed successfully"
	InputHasIssues = "Cannot validate input"

	ServerNoPreset            = "Cannot find a matching preset"
	ServerNoPresets           = "Cannot find presets"
	ServerNoTemplateFile      = "Cannot open the template file"
	ServerClosing             = "The server is shutting down"
	ServerPresetDeleted       = "The preset has been deleted"
	ServerPresetAlreadyExists = "The preset name is already taken"

	ServerStatusCreated = "Created"
	ServerStatusUpdated = "Updated"
)

// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { IsWindows } from 'qt-lib';

export const EXTENSION_ID = 'qt-python';
export const MS_PYTHON_ID = 'ms-python.python';
export const LOG_NAME = 'qt-python';

export const COMMAND_PREFIX = 'qt-python';
export const COMMAND_INSTALL_PYSIDE = 'installPySide6'; // contributes > commands
export const COMMAND_PYTHON_CREATE_ENV = 'python.createEnvironment';
export const COMMAND_PYTHON_SELECT_PYTHON = 'python.setInterpreter';

export const TASK_TYPE = 'pyside'; // contributes > taskDefinitions
export const TASK_SOURCE = 'PySide';

export const DEBUG_TYPE = 'pyside'; // contributes > debuggers
export const DEBUG_DELEGATE_TYPE = 'debugpy';
export const DEBUG_DEFAULT_ENTRY_POINT = 'main.py';

export const VENV_BIN_DIR = IsWindows ? 'Scripts' : 'bin';

export const TOML_PROJECT_FILE_NAME = 'pyproject.toml';
export const TOML_KEY_PROJECT_NAME = 'project.name';
export const TOML_KEY_PROJECT_FILES = 'tool.pyside6-project.files';

export const PYSIDE_PROJECT_TOOL = 'pyside6-project';
export const MAINT_WHEEL_DIR_NAME = 'QtForPython';

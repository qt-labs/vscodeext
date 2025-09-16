// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { IsWindows } from 'qt-lib';

export const EXTENSION_ID = 'theqtcompany.qt-python';
export const MS_PYTHON_ID = 'ms-python.python';
export const LOG_NAME = 'qt-python';

export const TASK = {
  TYPE: 'pyside', // contributes > taskDefinitions
  SOURCE: 'PySide'
};

export const DEBUG = {
  TYPE: 'pyside', // contributes > debuggers
  DELEGATE_TYPE: 'debugpy',
  DEFAULT_ENTRY_POINT: 'main.py'
};

export const VENV = {
  BIN_DIR: IsWindows ? 'Scripts' : 'bin'
};

export const EXECUTABLE_EXT = IsWindows ? '.exe' : '';
export const CORE_API_KEY_WORKSPACE_TYPE = 'workspaceType';

export const TOML_PROJECT_FILE_NAME = 'pyproject.toml';
export const TOML_KEY_PROJECT_NAME = 'project.name';
export const TOML_KEY_PROJECT_FILES = 'tool.pyside6-project.files';

export const PYSIDE_PROJECT_TOOL = 'pyside6-project';

// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

export const install = {
  popup: {
    installing: 'Installing PySide6...',
    installingQtPip: 'Installing qtpip...',
    installingCommercial: 'Installing PySide6 (Commercial)...',
    installed: (folder: string, pysideVersion: string, venv: string) =>
      `PySide ${pysideVersion} is installed for '${folder}' ` +
      `(venv: ${venv})`,
    alreadyInstalled: (folder: string, pysideVersion: string, venv: string) =>
      `PySide ${pysideVersion} is already installed for '${folder}' ` +
      `(venv: ${venv})`,
    installFailed: (folder: string) =>
      `Failed to install PySide for '${folder}'`,
    noVenv: (folder: string) =>
      `Cannot find a virtual environment for '${folder}'. ` +
      'Create or select a virtual environment first',
    buttonCreateEnv: 'Create environment',
    buttonCreateUvEnv: 'Create with uv',
    buttonSelectEnv: 'Select interpreter',
    linkShowLog: 'Show logs',
    creatingUvVenv: 'Creating virtual environment with uv...',
    uvVenvCreated: (folder: string, venv: string) =>
      `Virtual environment '${venv}' created for '${folder}' using uv`,
    uvVenvFailed: (folder: string) =>
      `Cannot create virtual environment for '${folder}' using uv`,
    uvNotFound:
      'uv is not installed or not on PATH. ' +
      'Install it from https://docs.astral.sh/uv/ or use the standard environment creator instead',
    uvVenvExists: (folder: string, venv: string) =>
      `Virtual environment '${venv}' already exists in '${folder}'. Overwrite it?`,
    buttonOverwrite: 'Overwrite',
    buttonCancel: 'Cancel'
  },
  placeHolder: {
    selectFolder: 'Select a folder',
    selectVersion: 'Select PySide version'
  },
  sourcePicker: {
    labelOss: 'Latest PySide6 from PyPI',
    labelCommercial: 'Latest PySide6 (Commercial) by qtpip',
    labelDownload:
      'Go to https://account.qt.io/ ' +
      'to download and install the wheels manually',
    annotationForLocal: 'from Qt installation root'
  }
};

export const others = {
  oldStyleProject: {
    warn: (folder: string) =>
      `Found an old-style project in '${folder}'. ` +
      'See the documentation on how to migrate to the new style',
    buttonOpenDoc: 'Open documentation',
    buttonDoNotShowAgain: 'Do not show again'
  }
};

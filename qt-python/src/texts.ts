// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

export const install = {
  popup: {
    installing: 'Installing PySide6...',
    installed: (folder: string, pysideVersion: string, venv: string) =>
      `PySide ${pysideVersion} is installed for '${folder}'. ` +
      `(venv: ${venv})`,
    alreadyInstalled: (folder: string, pysideVersion: string, venv: string) =>
      `PySide ${pysideVersion} is already installed for '${folder}'. ` +
      `(venv: ${venv})`,
    noVenv: (folder: string) =>
      `No virtual environment found for '${folder}'. ` +
      'Please create or select a virtual environment first.',
    buttonCreateEnv: 'Create Environment',
    buttonSelectEnv: 'Select Interpreter'
  },
  placeHolder: {
    selectFolder: 'Select a Folder',
    selectVersion: 'Select PySide Version'
  },
  sourcePicker: {
    labelOss: 'Latest PySide6 from PyPI',
    labelDownload:
      'Visit https://account.qt.io/ ' +
      'to download and install the wheels manually',
    annotationForLocal: 'from Qt installation root'
  }
};

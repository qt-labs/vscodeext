// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

export function registerProFile() {
  return vscode.workspace.onDidOpenTextDocument((document) => {
    if (document.fileName.toLowerCase().endsWith('.pro')) {
      // The code you place here will be executed every time a .pro file is opened
      // TODO : parse the .pro file and provide IntelliSense
      console.log('.pro file', document.fileName);
    }
  });
}

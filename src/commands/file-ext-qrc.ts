// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

export function registerQrcFile() {
  return vscode.workspace.onDidOpenTextDocument((document) => {
    if (document.fileName.toLowerCase().endsWith('.qrc')) {
      // The code you place here will be executed every time a .qrc file is opened
      // TODO : parse the .qrc file and provide IntelliSense for the resources
      console.log('.qrc file', document.fileName);
      vscode.languages.setTextDocumentLanguage(document, 'xml');
    }
  });
}

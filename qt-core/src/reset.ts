// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

export function resetCommand() {
  return vscode.commands.registerCommand('qt-core.reset', () => {
    const extensions = ['qt-cpp', 'qt-qml', 'qt-ui'];
    extensions.forEach((extension) => {
      void vscode.commands.executeCommand(`${extension}.reset`);
    });
  });
}

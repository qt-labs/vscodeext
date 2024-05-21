// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

export function registerOpenSettingsCommand() {
  return vscode.commands.registerCommand('qt-official.openSettings', () => {
    void vscode.commands.executeCommand(
      'workbench.action.openSettings',
      '@ext:theqtcompany.qt-official'
    );
  });
}

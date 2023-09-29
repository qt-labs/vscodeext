// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only OR GPL-2.0-only OR GPL-3.0-only

import * as vscode from 'vscode';

export async function pickDefaultQt() {
  const config = vscode.workspace.getConfiguration('vscode-qt-tools');
  let qtInstallations = config.get('qtInstallations') as readonly string[];

  if (qtInstallations.length === 0) {
    await vscode.commands
      .executeCommand('vscode-qt-tools.registerQt')
      .then(() => {
        qtInstallations = config.get('qtInstallations') as readonly string[];
      });
  }

  if (qtInstallations) {
    // Show a quick pick dialog with the Qt installations as options
    const selected = await vscode.window.showQuickPick(qtInstallations, {
      placeHolder: 'Select a default Qt installation'
    });
    if (selected) {
      // Update the 'vscode-qt-tools.defaultQt' configuration with the selected option
      await config.update(
        'defaultQt',
        selected as string,
        vscode.ConfigurationTarget.Workspace
      );
      vscode.commands.executeCommand('vscode-qt-tools.detectQtCMakeProject');
    }
  }
}

export function registerPickDefaultQtCommand() {
  return vscode.commands.registerCommand(
    'vscode-qt-tools.pickDefaultQt',
    pickDefaultQt
  );
}

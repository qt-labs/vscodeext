// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only OR GPL-2.0-only OR GPL-3.0-only

import * as vscode from 'vscode';
import * as qtpath from '../util/get-qt-paths';

// This is a placeholder for the actual implementation of the 'vscode-qt-tools.registerQt' command.
// Replace this with the actual code that was previously in 'extension.ts'.
const registerQt = async () => {
  const config = vscode.workspace.getConfiguration('vscode-qt-tools');

  // If no default Qt installation is registered, ask the user to register one
  const options: vscode.OpenDialogOptions = {
    canSelectMany: false,
    openLabel: 'Select The Qt installation path',
    canSelectFiles: false,
    canSelectFolders: true
  };

  vscode.window.showOpenDialog(options).then((fileUri) => {
    if (typeof fileUri === 'undefined') {
      return;
    } else if (fileUri && fileUri[0]) {
      const folder = fileUri[0].fsPath;
      if (folder) {
        // Search the directory for Qt installations
        const qtInstallations = qtpath.findQtInstallations(folder);
        if (qtInstallations.length === 0) {
          vscode.window.showInformationMessage(
            `Found no any Qt environments in the specified installation.`
          );
        } else {
          vscode.window.showInformationMessage(
            `Found ${qtInstallations.length} Qt installation(s).`
          );

          // Store qtInstallations folders in the global configuration
          config
            .update(
              'qtInstallations',
              qtInstallations,
              vscode.ConfigurationTarget.Global
            )
            .then(() => {
              // Call vscode-qt-tools.defaultQt to pick default Qt installation
              vscode.commands.executeCommand('vscode-qt-tools.pickDefaultQt'); // TODO: use config watcher instead
            });
        }
      }
    }
  });
};

// Register the 'vscode-qt-tools.registerQt' command
export function registerQtCommand() {
  return vscode.commands.registerCommand(
    'vscode-qt-tools.registerQt',
    registerQt
  );
}

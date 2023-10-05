// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only OR GPL-2.0-only OR GPL-3.0-only

import * as vscode from 'vscode';
import * as qtpath from '../util/get-qt-paths';

async function saveSelectedQt(fileUris: vscode.Uri[] | undefined) {
  if (typeof fileUris === 'undefined') {
    return;
  } else if (fileUris) {
    const qtInstallationPromises = fileUris.map((uri) =>
      qtpath.findQtInstallations(uri.fsPath)
    );
    const qtInstallationSets = await Promise.all(qtInstallationPromises);
    const qtInstallations = ([] as string[]).concat.apply(
      [],
      qtInstallationSets
    );
    if (qtInstallations.length === 0) {
      vscode.window.showInformationMessage(
        `Found no any Qt environments in the specified installation.`
      );
    } else {
      vscode.window.showInformationMessage(
        `Found ${qtInstallations.length} Qt installation(s).`
      );
      const config = vscode.workspace.getConfiguration('vscode-qt-tools');
      await Promise.all([
        config.update(
          'qtFolders',
          fileUris.map((uri) => uri.fsPath),
          vscode.ConfigurationTarget.Global
        ),
        config.update(
          'qtInstallations',
          qtInstallations,
          vscode.ConfigurationTarget.Global
        )
      ]);
    }
  }
}

// This is a placeholder for the actual implementation of the 'vscode-qt-tools.registerQt' command.
// Replace this with the actual code that was previously in 'extension.ts'.
async function registerQt() {
  // If no default Qt installation is registered, ask the user to register one
  const options: vscode.OpenDialogOptions = {
    canSelectMany: false,
    openLabel: 'Select The Qt installation path',
    canSelectFiles: false,
    canSelectFolders: true
  };
  vscode.window.showOpenDialog(options).then(saveSelectedQt);
}

// Register the 'vscode-qt-tools.registerQt' command
export function registerQtCommand() {
  return vscode.commands.registerCommand(
    'vscode-qt-tools.registerQt',
    registerQt
  );
}

// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { Home, IsLinux, IsMacOS, IsWindows } from '@util/os';
import { CMAKE_GLOBAL_KITS_FILEPATH, Kit, KitManager } from '@/kit-manager';

export async function registerQt() {
  const options: vscode.OpenDialogOptions = {
    canSelectMany: false,
    openLabel: 'Select Qt installation directory',
    canSelectFiles: false,
    canSelectFolders: true
  };
  const selectedQtFolderUri = await vscode.window.showOpenDialog(options);
  if (!selectedQtFolderUri) {
    return;
  }
  const selectedQtFolder = selectedQtFolderUri[0].fsPath;
  if (selectedQtFolder) {
    void KitManager.setGlobalQtFolder(selectedQtFolder);
  }
  return 0;
}

export async function setDoNotAskForDefaultQtFolder(value: boolean) {
  await vscode.workspace
    .getConfiguration('vscode-qt-tools')
    .update(
      'doNotAskForDefaultQtFolder',
      value,
      vscode.ConfigurationTarget.Global
    );
}

function getDoNotAskForDefaultQtFolder(): boolean {
  return (
    vscode.workspace
      .getConfiguration('vscode-qt-tools')
      .get<boolean>('doNotAskForDefaultQtFolder') ?? false
  );
}

export function checkDefaultQtFolderPath() {
  if (getDoNotAskForDefaultQtFolder()) {
    return;
  }

  if (KitManager.getCurrentGlobalQtFolder()) {
    // Qt folder is already set. No need to check for default path
    return;
  }
  let defaultPath = '';
  if (IsLinux || IsMacOS) {
    defaultPath = path.join(Home, 'Qt');
  } else if (IsWindows) {
    defaultPath = path.join('C:', 'Qt');
  } else {
    throw new Error('Unsupported OS');
  }

  const defaultPathExists = fs.existsSync(defaultPath);
  if (!defaultPathExists) {
    return;
  }

  const setDefaultPathButtonMessage = 'Set Qt folder';
  const doNotShowAgainButtonMessage = 'Do not show again';
  void vscode.window
    .showInformationMessage(
      `Qt folder was found at "${defaultPath}". Do you want to use it?`,
      setDefaultPathButtonMessage,
      doNotShowAgainButtonMessage
    )
    .then((response) => {
      if (response === setDefaultPathButtonMessage) {
        void KitManager.setGlobalQtFolder(defaultPath);
      } else if (response === doNotShowAgainButtonMessage) {
        void setDoNotAskForDefaultQtFolder(true);
      }
    });
}

export function registerQtCommand(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-qt-tools.registerQt', registerQt)
  );
}

export async function getSelectedQtInstallationPath(
  folder?: vscode.WorkspaceFolder
) {
  if (folder === undefined) {
    const activeFolder = await vscode.commands.executeCommand<string>(
      'cmake.activeFolderPath'
    );
    if (activeFolder === '') {
      throw new Error('No active folder found.');
    }
    folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(activeFolder));
  }
  const selectedCMakeKit = await vscode.commands.executeCommand<string>(
    'cmake.buildKit',
    folder
  );
  if (!selectedCMakeKit || selectedCMakeKit === '__unspec__') {
    // show information message to the user
    void vscode.window
      .showInformationMessage(
        'No CMake kit selected. Please select a CMake kit.',
        ...['Select CMake Kit']
      )
      .then((selection) => {
        if (selection === 'Select CMake Kit') {
          void vscode.commands.executeCommand('cmake.selectKit');
        }
      });
    return '';
  }
  const addtionalKits = vscode.workspace
    .getConfiguration('cmake')
    .get<string[]>('additionalKits');
  const workspaceFolderKitsPath =
    folder !== undefined
      ? KitManager.getCMakeWorkspaceKitsFilepath(folder)
      : '';
  const kitFiles = [workspaceFolderKitsPath, CMAKE_GLOBAL_KITS_FILEPATH];
  if (addtionalKits) {
    kitFiles.push(...addtionalKits);
  }

  for (const file of kitFiles) {
    if (!fs.existsSync(file)) {
      continue;
    }
    const contentPromise = fs.promises.readFile(file, 'utf8');
    let kits: Kit[] = [];
    try {
      kits = JSON.parse(await contentPromise) as Kit[];
    } catch (error) {
      console.error('Failed to parse kits file:', error);
    }
    const selectedQtKit = kits.find((kit) => kit.name === selectedCMakeKit);

    if (selectedQtKit === undefined) {
      continue;
    }
    if (selectedQtKit.environmentVariables?.VSCODE_QT_FOLDER === undefined) {
      void vscode.window.showErrorMessage(
        '"VSCODE_QT_FOLDER" environment variable is not set for "' +
          selectedCMakeKit +
          '".'
      );
      continue;
    }

    const selectedQtKitPath =
      selectedQtKit.environmentVariables.VSCODE_QT_FOLDER;

    if (fs.existsSync(selectedQtKitPath)) {
      return selectedQtKitPath;
    }
    void vscode.window.showErrorMessage(
      `"${selectedQtKitPath}" does not exist in "${selectedCMakeKit}".`
    );
  }

  // Note: If a workspace is added to a workspacefile, the below message may be
  // shown. Becase cmake.buildKit at the beggining if this function is called
  // before the cmake extension resolves the cmake kit in the newly added
  // workspace folder.
  // TODO: Wait until the cmake extension resolves the cmake kit.
  void vscode.window.showErrorMessage(
    selectedCMakeKit + ' is not a valid Qt kit.'
  );
  return '';
}

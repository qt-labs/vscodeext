// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import * as qtpath from '../util/get-qt-paths';
import * as local from '../util/localize';
import * as util from '../util/util';
import * as fs from 'fs';
import * as path from 'path';

export const RegisterQtCommandId = 'vscode-qt-tools.registerQt';
let RegisterQtCommandTitle = '';

export function getRegisterQtCommandTitle(): string {
  return RegisterQtCommandTitle;
}

const QtFolderConfig = 'qtFolder';

async function gotInstallationSets(
  qtInstallationPromises: Promise<string[]>,
  filePaths: string
) {
  const qtInstallationSets = await qtInstallationPromises;
  const qtInstallations = ([] as string[]).concat.apply([], qtInstallationSets);
  if (qtInstallations.length === 0) {
    void vscode.window.showInformationMessage(
      `Found no any Qt environments in the specified installation.`
    );
    console.log('Found no any Qt environments in the specified installation.');
  } else {
    void vscode.window.showInformationMessage(
      `Found ${qtInstallations.length} Qt installation(s).`
    );
    console.log(`Found ${qtInstallations.length} Qt installation(s).`);
    const config = vscode.workspace.getConfiguration('vscode-qt-tools');
    const configTarget = util.isTestMode()
      ? vscode.ConfigurationTarget.Workspace
      : vscode.ConfigurationTarget.Global;
    await Promise.all([
      config.update(QtFolderConfig, filePaths, configTarget),
      config.update('qtInstallations', qtInstallations, configTarget)
    ]);
  }
}

async function saveSelectedQt(folderPath: string) {
  if (folderPath.length !== 0) {
    const qtInstallationPromises = qtpath.findQtInstallations(folderPath);
    await gotInstallationSets(qtInstallationPromises, folderPath);
  }
}

// This is a placeholder for the actual implementation of the 'vscode-qt-tools.registerQt' command.
// Replace this with the actual code that was previously in 'extension.ts'.
export async function registerQt() {
  // If no default Qt installation is registered, ask the user to register one
  const options: vscode.OpenDialogOptions = {
    canSelectMany: false,
    openLabel: 'Select The Qt installation path',
    canSelectFiles: false,
    canSelectFolders: true
  };
  const selectedQtFolderUri = await vscode.window.showOpenDialog(options);
  if (!selectedQtFolderUri) {
    throw new Error('No Qt installation path selected');
  }
  const selectedQtFolder = selectedQtFolderUri[0].fsPath;
  if (selectedQtFolder) {
    await saveSelectedQt(selectedQtFolder);
  }
  return 0;
}

export async function checkForQtInstallationsUpdates() {
  const qtFolder = getQtFolder();

  const promiseInstallationSetsProcessed = gotInstallationSets(
    qtpath.findQtInstallations(qtFolder),
    qtFolder
  );
  const watcher = vscode.workspace.createFileSystemWatcher(qtFolder);
  watcher.onDidChange(checkForQtInstallationsUpdates);
  watcher.onDidCreate(checkForQtInstallationsUpdates);
  watcher.onDidDelete(checkForQtInstallationsUpdates);
  await promiseInstallationSetsProcessed;
}

export function getQtFolder(): string {
  return (
    vscode.workspace
      .getConfiguration('vscode-qt-tools')
      .get<string>(QtFolderConfig) ?? ''
  );
}

// Register the 'vscode-qt-tools.registerQt' command
export function registerQtCommand(context: vscode.ExtensionContext) {
  RegisterQtCommandTitle = local.getCommandTitle(context, RegisterQtCommandId);
  context.subscriptions.push(
    vscode.commands.registerCommand(RegisterQtCommandId, registerQt)
  );
}

export async function getSelectedQtInstallationPath(): Promise<string> {
  const selectedCMakeKit =
    await vscode.commands.executeCommand<string>('cmake.buildKit');
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
    throw new Error('No CMake kit selected');
  }
  const splittedKit = selectedCMakeKit.split('-');
  if (splittedKit.length < 3) {
    throw new Error('Unable to parse selected CMake kit');
  }
  const qtFolder = getQtFolder();
  if (!qtFolder) {
    throw new Error('No Qt installation path selected');
  }
  const version = splittedKit[1];
  const kitType = splittedKit[2];
  const selectedQtKitPath = path.join(qtFolder, version, kitType);
  if (!fs.existsSync(selectedQtKitPath)) {
    throw new Error('Selected Qt installation path does not exist');
  }

  return selectedQtKitPath;
}

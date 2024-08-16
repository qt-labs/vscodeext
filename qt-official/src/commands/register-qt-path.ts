// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as fs from 'fs';

import { createLogger, askForKitSelection } from 'qt-lib';
import { isError } from '@/util/util';
import { CMAKE_GLOBAL_KITS_FILEPATH, Kit, KitManager } from '@/kit-manager';

const logger = createLogger('register-qt-path');

export async function checkSelectedKitandAskForKitSelection() {
  const selectedKit = await vscode.commands.executeCommand('cmake.buildKit');
  if (!selectedKit || selectedKit === '__unspec__') {
    askForKitSelection();
    return false;
  }
  return true;
}

export async function getSelectedQtInstallationPath(
  folder?: vscode.WorkspaceFolder
) {
  if (folder === undefined) {
    const activeFolder = await vscode.commands.executeCommand<string>(
      'cmake.activeFolderPath'
    );
    if (activeFolder === '') {
      logger.error('No active folder found.');
      throw new Error('No active folder found.');
    }
    folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(activeFolder));
  }
  const selectedCMakeKit = await vscode.commands.executeCommand<string>(
    'cmake.buildKit',
    folder
  );
  logger.info('Selected CMake kit:', selectedCMakeKit);
  if (!(await checkSelectedKitandAskForKitSelection())) {
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
      if (isError(error)) {
        logger.error('Failed to parse kits file:', error.message);
      }
    }
    const selectedQtKit = kits.find((kit) => kit.name === selectedCMakeKit);

    if (selectedQtKit === undefined) {
      continue;
    }
    if (selectedQtKit.environmentVariables?.VSCODE_QT_FOLDER === undefined) {
      const errorMessage =
        '"VSCODE_QT_FOLDER" environment variable is not set for "' +
        selectedCMakeKit +
        '".';
      logger.error(errorMessage);
      void vscode.window.showErrorMessage(errorMessage);
      continue;
    }

    const selectedQtKitPath =
      selectedQtKit.environmentVariables.VSCODE_QT_FOLDER;

    if (fs.existsSync(selectedQtKitPath)) {
      logger.info('Selected Qt installation path:', selectedQtKitPath);
      return selectedQtKitPath;
    }
    const errorMessage = `"${selectedQtKitPath}" does not exist in "${selectedCMakeKit}".`;
    logger.error(errorMessage);
    void vscode.window.showErrorMessage(errorMessage);
  }

  // Note: If a workspace is added to a workspacefile, the below message may be
  // shown. Becase cmake.buildKit at the beggining if this function is called
  // before the cmake extension resolves the cmake kit in the newly added
  // workspace folder.
  // TODO: Wait until the cmake extension resolves the cmake kit.
  const errorMessage = selectedCMakeKit + ' is not a valid Qt kit.';
  logger.error(errorMessage);
  void vscode.window.showErrorMessage(errorMessage);
  return '';
}

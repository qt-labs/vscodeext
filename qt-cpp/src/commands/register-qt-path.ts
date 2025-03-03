// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as fs from 'fs';

import { createLogger, askForKitSelection, isError } from 'qt-lib';
import { CMAKE_GLOBAL_KITS_FILEPATH, Kit, KitManager } from '@/kit-manager';

const logger = createLogger('register-qt-path');

export function IsQtKit(kit: Kit) {
  return IsQtInsKit(kit) || IsQtPathsKit(kit);
}

export function IsQtInsKit(kit: Kit) {
  return getQtInsRoot(kit) !== undefined;
}

export function IsQtPathsKit(kit: Kit) {
  return getQtPathsExe(kit) !== undefined;
}

export function getQtInsRoot(kit: Kit) {
  // Keep VSCODE_QT_FOLDER for backward compatibility.
  return (
    kit.environmentVariables?.VSCODE_QT_INSTALLATION ??
    kit.environmentVariables?.VSCODE_QT_FOLDER
  );
}

export function getQtPathsExe(kit: Kit) {
  return kit.environmentVariables?.VSCODE_QT_QTPATHS_EXE;
}

async function getActiveFolder() {
  const activeFolder = await vscode.commands.executeCommand<string>(
    'cmake.activeFolderPath'
  );
  if (activeFolder === '') {
    logger.error('No active folder found.');
    throw new Error('No active folder found.');
  }
  return vscode.workspace.getWorkspaceFolder(vscode.Uri.file(activeFolder));
}
async function getSelectedKitName(folder?: vscode.WorkspaceFolder) {
  if (folder === undefined) {
    folder = await getActiveFolder();
  }
  const selectedKit = await vscode.commands.executeCommand<string>(
    'cmake.buildKit',
    folder
  );
  logger.info('Selected CMake kit:', selectedKit);
  if (!selectedKit || selectedKit === '__unspec__' || selectedKit === '') {
    return undefined;
  }
  return selectedKit;
}
export async function getSelectedKit(
  folder?: vscode.WorkspaceFolder,
  silent = false
) {
  if (folder === undefined) {
    folder = await getActiveFolder();
  }
  const selectedKitName = await getSelectedKitName(folder);
  if (selectedKitName === undefined) {
    if (!silent) {
      askForKitSelection();
    }
    return undefined;
  }

  const addtionalKits = vscode.workspace
    .getConfiguration('cmake')
    .get<string[]>('additionalKits');
  const workspaceFolderKitsPath =
    folder !== undefined
      ? KitManager.getCMakeWorkspaceKitsFilepath(folder)
      : '';
  if (!CMAKE_GLOBAL_KITS_FILEPATH) {
    throw new Error('CMAKE_GLOBAL_KITS_FILEPATH is undefined.');
  }
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
    const selectedQtKit = kits.find((kit) => kit.name === selectedKitName);

    if (selectedQtKit) {
      return selectedQtKit;
    }
  }
  // Note: If a workspace is added to a workspacefile, the below message may be
  // shown. Becase cmake.buildKit at the beggining if this function is called
  // before the cmake extension resolves the cmake kit in the newly added
  // workspace folder.
  // TODO: Wait until the cmake extension resolves the cmake kit.
  // TODO: Make this error silent in some cases.
  const errorMessage = selectedKitName + ' is not a valid Qt kit.';
  logger.error(errorMessage);
  void vscode.window.showErrorMessage(errorMessage);
  return undefined;
}

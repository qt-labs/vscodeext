// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import path from 'path';
import * as child_process from 'child_process';

import {
  CoreKey,
  createLogger,
  exists,
  findQtPathsInKitDir,
  IsMacOS,
  IsWindows,
  OSExeSuffix,
  searchForExeInQtInfo,
  telemetry,
  QtWorkspaceFeatures
} from 'qt-lib';
import { coreAPI, projectManager } from '@/extension';
import { EXTENSION_ID } from '@/constants';

const logger = createLogger('translation');

export function registerOpenInLinguistCommand() {
  return vscode.commands.registerCommand(
    `${EXTENSION_ID}.openInLinguist`,
    openInLinguistCommand
  );
}

export async function openInLinguistCommand() {
  telemetry.sendAction('openInLinguist');
  const activeDocument = vscode.window.activeTextEditor?.document.uri;
  if (!activeDocument) {
    logger.error('No active editor found');
    return;
  }
  const project = projectManager.findProjectContainingFile(activeDocument);
  if (!project) {
    logger.error('The active document does not belong to a project');
    return;
  }
  const workspaceFeatures = coreAPI?.getValue<QtWorkspaceFeatures>(
    project.folder,
    CoreKey.WORKSPACE_FEATURES
  );
  const venvBinPath = coreAPI?.getValue<string>(
    project.folder,
    CoreKey.VENV_BIN_PATH
  );
  const selectedKitPath = coreAPI?.getValue<string>(
    project.folder,
    CoreKey.SELECTED_KIT_PATH
  );
  const selectedQtPaths = coreAPI?.getValue<string>(
    project.folder,
    CoreKey.SELECTED_QT_PATHS
  );
  let linguistPath: string | undefined;

  if (workspaceFeatures?.projectTypes.pyside) {
    if (venvBinPath) {
      linguistPath = await locateLinguistFromVenvBinPaths(venvBinPath);
    }
  }

  if (workspaceFeatures?.projectTypes.cmake) {
    if (selectedKitPath) {
      linguistPath = await locateLinguist(selectedKitPath);
    } else if (selectedQtPaths) {
      linguistPath = await locateLinguistFromQtPaths(selectedQtPaths);
    }
  }

  if (!linguistPath) {
    logger.error('Linguist executable not found');

    const isCMake = !!workspaceFeatures?.projectTypes.cmake;
    const isPySide = !!workspaceFeatures?.projectTypes.pyside;
    const message = ['Cannot find the Qt Linguist executable'];

    if (isCMake && !isPySide) {
      message.push('Check that the Qt version in the kit includes Qt Linguist');
    } else if (!isCMake && isPySide) {
      message.push(
        'Check that PySide6 is properly installed ' +
          'in a valid virtual environment'
      );
    }

    void vscode.window.showErrorMessage(message.join('. '));
    return;
  }
  if (!(await exists(linguistPath))) {
    const err = `Linguist executable not found at ${linguistPath}`;
    logger.error(err);
    void vscode.window.showErrorMessage(err);
    return;
  }
  logger.info(
    `Opening Linguist at ${linguistPath} for file ${activeDocument.fsPath}`
  );
  openInLinguist(linguistPath, activeDocument.fsPath);
}

const LinguistExeName = IsMacOS ? 'Linguist' : 'linguist' + OSExeSuffix;

function getLinguistExePath(selectedQtBinPath: string) {
  const macOSPath = path.join(
    'Linguist.app',
    'Contents',
    'MacOS',
    LinguistExeName
  );
  return IsMacOS
    ? path.join(selectedQtBinPath, macOSPath)
    : path.join(selectedQtBinPath, LinguistExeName);
}

async function locateLinguistFromQtPaths(selectedQtPaths: string) {
  const qtInfo = coreAPI?.getQtInfoFromPath(selectedQtPaths);
  if (!qtInfo) {
    return undefined;
  }
  return searchForExeInQtInfo(qtInfo, getLinguistExePath);
}

async function locateLinguist(selectedKitPath: string) {
  let linguistExePath = getLinguistExePath(path.join(selectedKitPath, 'bin'));
  if (await exists(linguistExePath)) {
    return linguistExePath;
  }
  const qtPaths = findQtPathsInKitDir(selectedKitPath);
  if (qtPaths) {
    const linguistPath = await locateLinguistFromQtPaths(qtPaths);
    if (linguistPath) {
      return linguistPath;
    }
  }

  if (!IsWindows) {
    linguistExePath = '/usr/bin/linguist';
    if (await exists(linguistExePath)) {
      return linguistExePath;
    }
  }

  return '';
}

async function locateLinguistFromVenvBinPaths(venvBinPath: string) {
  const candidate = path.join(venvBinPath, 'pyside6-linguist' + OSExeSuffix);
  return (await exists(candidate)) ? candidate : undefined;
}

function openInLinguist(linguistPath: string, file: string) {
  const child = child_process.spawn(linguistPath, [file], {
    stdio: 'inherit',
    shell: true
  });

  child.on('error', (error) => {
    const err = `Failed to start Linguist: ${error.message}`;
    logger.error(err);
    void vscode.window.showErrorMessage(err);
  });
}

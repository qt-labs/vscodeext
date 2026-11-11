// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import {
  createLogger,
  isPathToQtPathsOrQMake,
  QtWorkspaceConfigMessage,
  QtAdditionalPath,
  host,
  telemetry,
  resolveConfiguration,
  CoreKey,
  coreSettings
} from 'qt-lib';
import { EXTENSION_ID } from '@/constants';
import { coreAPI } from '@/extension';
import { convertAdditionalQtPaths } from '@/util';
import { warnAboutMissingQtPath } from '@/qtpaths';

const logger = createLogger('installation-root');

async function setDoNotAskForDefaultQtInstallationRoot(value: boolean) {
  await coreSettings.skipDefaultInsRootPrompt.updateGlobal(value);
}

function getDoNotAskForDefaultQtInstallationRoot(): boolean {
  return coreSettings.skipDefaultInsRootPrompt.get() ?? false;
}

export function getCurrentGlobalQtInstallationRoot(): string {
  const insRoot = coreSettings.insRoot.inspect()?.globalValue;
  return insRoot ? resolveConfiguration(insRoot) : '';
}

export function getCurrentGlobalAdditionalQtPaths(): QtAdditionalPath[] {
  const value = coreSettings.additionalQtPaths.inspect()?.globalValue;
  return value ? convertAdditionalQtPaths(value) : [];
}

export function getDefaultQtRootCandidates(): string[] {
  if (!host.isUnix && !host.isWindows) {
    const errorMessage = 'Unsupported OS';
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }
  const defaultQtInsRootName = 'Qt';
  if (!host.userHome) {
    throw new Error('Home is undefined');
  }
  const unixDefaultPaths = [
    path.join(host.userHome, defaultQtInsRootName),
    path.join(host.userHome, 'dev', defaultQtInsRootName),
    path.join('/', 'opt', defaultQtInsRootName)
  ];
  const winRoot =
    process.env.WINDIR !== undefined
      ? path.parse(process.env.WINDIR).root
      : 'C:';
  const winDefaultPaths = [
    path.join(winRoot, defaultQtInsRootName),
    path.join(winRoot, 'dev', defaultQtInsRootName)
  ];
  if (process.env.USERNAME) {
    winDefaultPaths.push(
      path.join(winRoot, 'Users', process.env.USERNAME, defaultQtInsRootName)
    );
  }
  if (process.env.USERPROFILE) {
    winDefaultPaths.push(
      path.join(process.env.USERPROFILE, defaultQtInsRootName)
    );
  }
  if (process.env.SYSTEMDRIVE) {
    winDefaultPaths.push(
      path.join(process.env.SYSTEMDRIVE, defaultQtInsRootName)
    );
  }
  if (process.env.HOMEDRIVE && process.env.HOMEPATH) {
    winDefaultPaths.push(
      path.join(
        process.env.HOMEDRIVE,
        process.env.HOMEPATH,
        defaultQtInsRootName
      )
    );
  }
  if (host.isMacOS) {
    unixDefaultPaths.push(path.join('/', 'Applications', defaultQtInsRootName));
    unixDefaultPaths.push(
      path.join(host.userHome, 'Applications', defaultQtInsRootName)
    );
  }
  const defaultPaths = host.isUnix ? unixDefaultPaths : winDefaultPaths;
  return defaultPaths;
}

function getPossibleDefaultQtInstallationRoot() {
  const defaultPaths = getDefaultQtRootCandidates();
  const foundDefaultPath = defaultPaths.find((defPath) =>
    fs.existsSync(defPath)
  );
  return foundDefaultPath;
}

export function checkDefaultQtInsRootPath() {
  if (getDoNotAskForDefaultQtInstallationRoot()) {
    return;
  }

  if (getCurrentGlobalQtInstallationRoot()) {
    // Qt installation root is already set. No need to check for default path
    return;
  }

  const foundDefaultPath = getPossibleDefaultQtInstallationRoot();
  if (!foundDefaultPath) {
    return;
  }

  const setDefaultPathButtonMessage = 'Set Qt Installation Root';
  const doNotShowAgainButtonMessage = 'Do not show again';
  void vscode.window
    .showInformationMessage(
      `Qt installation root was found at "${foundDefaultPath}". Do you want to use it?`,
      setDefaultPathButtonMessage,
      doNotShowAgainButtonMessage
    )
    .then((response) => {
      if (response === setDefaultPathButtonMessage) {
        telemetry.sendConfig('useDefaultQtInstallationRoot');
        void setGlobalQtInstallationRoot(foundDefaultPath);
      } else if (response === doNotShowAgainButtonMessage) {
        telemetry.sendConfig('doNotAskForDefaultQtInstallationRoot');
        void setDoNotAskForDefaultQtInstallationRoot(true);
      }
    });
}
export function registerRegisterQtCommand() {
  return vscode.commands.registerCommand(
    `${EXTENSION_ID}.registerQt`,
    registerQt
  );
}

//Test-specific command
export function registerRegisterQtByPathCommand() {
  return vscode.commands.registerCommand(
    `${EXTENSION_ID}.registerQtByPath`,
    setGlobalQtInstallationRoot
  );
}

async function registerQt() {
  telemetry.sendAction('registerQt');
  const options: vscode.OpenDialogOptions = {
    canSelectMany: false,
    openLabel: 'Select Qt installation root',
    canSelectFiles: false,
    canSelectFolders: true
  };
  const defaultQtInsRoot = getPossibleDefaultQtInstallationRoot();
  if (defaultQtInsRoot) {
    options.defaultUri = vscode.Uri.file(defaultQtInsRoot);
  }
  const selectedQtInsRootUri = await vscode.window.showOpenDialog(options);
  if (selectedQtInsRootUri?.[0] === undefined) {
    return;
  }
  const selectedQtInsRoot = selectedQtInsRootUri[0].fsPath;
  if (selectedQtInsRoot) {
    void setGlobalQtInstallationRoot(selectedQtInsRoot);
  }
  return 0;
}

async function setGlobalQtInstallationRoot(qtInsRoot: string) {
  logger.info(`Setting global Qt installation root to: ${qtInsRoot}`);
  await coreSettings.insRoot.updateGlobal(qtInsRoot);
}

export function onQtInsRootUpdated(
  newQtInstallationRoot: string,
  folder: vscode.WorkspaceFolder | string
) {
  if (newQtInstallationRoot) {
    if (!fs.existsSync(newQtInstallationRoot)) {
      logger.warn(`The specified Qt installation path does not exist.`);
      void vscode.window.showWarningMessage(
        `The specified Qt installation path does not exist.`
      );
    }
  }
  logger.info(`Qt installation root updated: "${newQtInstallationRoot}"`);

  const message = new QtWorkspaceConfigMessage(folder);
  coreAPI?.setValue(
    folder,
    CoreKey.QT_INSTALLATION_ROOT,
    newQtInstallationRoot
  );
  message.config.add(CoreKey.QT_INSTALLATION_ROOT);
  logger.info(`Notifying coreAPI with message: ${message.toString()}`);
  coreAPI?.notify(message);
}

export function onAdditionalQtPathsUpdated(
  newPaths: QtAdditionalPath[],
  folder: vscode.WorkspaceFolder | string
) {
  for (const p of newPaths) {
    if (!fs.existsSync(p.path)) {
      warnAboutMissingQtPath(p, folder);
    } else if (!isPathToQtPathsOrQMake(p.path)) {
      const msg = `The specified additional Qt installation '${p.path}' does not point to qtpaths nor qmake.`;
      logger.error(msg);
      void vscode.window.showWarningMessage(msg);
    }
  }
  logger.info('Additional Qt Paths updated: ' + JSON.stringify(newPaths));

  const message = new QtWorkspaceConfigMessage(folder);
  coreAPI?.setValue(folder, CoreKey.ADDITIONAL_QT_PATHS, newPaths);
  message.config.add(CoreKey.ADDITIONAL_QT_PATHS);
  logger.info(`Notifying coreAPI with message: ${message.toString()}`);
  coreAPI?.notify(message);
}

// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import which from 'which';

import {
  createLogger,
  generateDefaultQtPathsName,
  CoreKey,
  QtAdditionalPath,
  resolveConfiguration,
  telemetry,
  coreSettings
} from 'qt-lib';
import { convertAdditionalQtPaths } from '@/util';
import {
  getCurrentGlobalAdditionalQtPaths,
  onAdditionalQtPathsUpdated
} from '@/installation-root';
import { coreAPI } from '@/extension';
import { EXTENSION_ID } from '@/constants';

const logger = createLogger('qtpaths');

export function registerQtByQtpaths() {
  return vscode.commands.registerCommand(
    `${EXTENSION_ID}.registerQtByQtpaths`,
    () => {
      telemetry.sendAction('registerQtByQtpaths');
      const options: vscode.OpenDialogOptions = {
        canSelectMany: false,
        openLabel: 'Select',
        title: 'Select a qtpaths or qmake executable',
        canSelectFiles: true,
        canSelectFolders: false
      };
      void vscode.window.showOpenDialog(options).then((selected) => {
        if (selected) {
          const selectedPath = selected[0]?.fsPath;
          if (!selectedPath) {
            return;
          }
          addQtPathToSettings({ path: selectedPath });
        }
      });
    }
  );
}

export function checkQtpathsInEnvPath(): void {
  // Check if qtpaths or qmake is in the PATH environment variable
  const envPath = process.env.PATH ?? '';
  if (!envPath) {
    logger.warn('PATH environment variable is not set');
    return;
  }
  const exeNames = ['qtpaths', 'qmake'];
  let exePath: string | null = null;
  for (const exeName of exeNames) {
    exePath = which.sync(exeName, { nothrow: true });
    if (exePath) {
      logger.info(`Found ${exeName} in PATH: ${exePath}`);
      break;
    }
  }
  if (!exePath) {
    logger.info('No qtpaths or qmake found in PATH');
    return;
  }
  const ret = coreAPI?.getQtInfo({ path: exePath });
  if (!ret?.info) {
    logger.error(`Failed to get Qt info for ${exePath}`);
    logger.error(String(ret?.err));
    return;
  }
  const name = generateDefaultQtPathsName(ret.info) + '_from_PATH';
  const qtPath: QtAdditionalPath = { path: exePath, name: name };
  const currentQtPaths = getCurrentGlobalAdditionalQtPaths();
  if (currentQtPaths.some((p) => p.path === qtPath.path)) {
    logger.info(`${qtPath.path} already exists in the settings`);
    return;
  }
  logger.info(
    `Added ${qtPath.path} to the settings with name: ${String(qtPath.name)}`
  );
  addQtPathToSettings(qtPath);
  telemetry.sendConfig('qtpathsFromEnvPath');
}

export function addQtPathToSettings(qtPath: QtAdditionalPath) {
  const info = coreAPI?.getQtInfo(qtPath).info;
  if (!info) {
    throw new Error(`Failed to get Qt info for ${qtPath.path}`);
  }

  if (!qtPath.name) {
    qtPath.name = generateDefaultQtPathsName(info);
  }

  const config = coreSettings.additionalQtPaths;
  const additionalQtPaths = config.inspect()?.globalValue;
  if (!additionalQtPaths) {
    logger.info(`${config.name} not found in the settings`);
  }

  const value: (string | object)[] = [
    ...(additionalQtPaths ?? []),
    { name: qtPath.name, path: qtPath.path }
  ];

  logger.info(`Adding ${qtPath.path} to the settings`);
  void config.updateGlobal(value);
  onAdditionalQtPathsUpdated(
    convertAdditionalQtPaths(value),
    CoreKey.GLOBAL_WORKSPACE
  );
}

export const RemoveFromSettingsButton = 'Remove from settings';

export function removeQtPathFromSettings(
  targetPath: string,
  folder?: vscode.WorkspaceFolder
) {
  const config = coreSettings.forScope(folder).additionalQtPaths;
  const inspected = config.inspect();
  const currentValue = folder
    ? inspected?.workspaceFolderValue
    : inspected?.globalValue;
  if (!currentValue) {
    logger.warn(`${config.name} not found in the settings`);
    return;
  }
  const matchesTarget = (entry: string | object) => {
    const rawPath =
      typeof entry === 'string' ? entry : (entry as QtAdditionalPath).path;
    return resolveConfiguration(rawPath) === targetPath;
  };
  const filtered = currentValue.filter((entry) => !matchesTarget(entry));
  if (filtered.length === currentValue.length) {
    const msg = `"${targetPath}" was not found in ${config.name}`;
    logger.warn(msg);
    void vscode.window.showInformationMessage(msg);
    return;
  }
  logger.info(`Removing ${targetPath} from the settings`);
  const scope = folder
    ? vscode.ConfigurationTarget.WorkspaceFolder
    : vscode.ConfigurationTarget.Global;
  config.update(filtered, scope).then(undefined, (err: unknown) => {
    logger.error(`Failed to update ${config.name}: ${String(err)}`);
  });
}

export function warnAboutMissingQtPath(
  p: QtAdditionalPath,
  folder?: vscode.WorkspaceFolder | string
) {
  // A string folder means the global workspace (CoreKey.GLOBAL_WORKSPACE).
  const workspaceFolder = typeof folder === 'string' ? undefined : folder;
  const msg = `The specified additional Qt installation '${p.path}' does not exist.`;
  logger.warn(msg);
  void vscode.window
    .showWarningMessage(msg, RemoveFromSettingsButton)
    .then((response) => {
      if (response === RemoveFromSettingsButton) {
        removeQtPathFromSettings(p.path, workspaceFolder);
      }
    });
}

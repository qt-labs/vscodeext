// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import which from 'which';

import {
  AdditionalQtPathsName,
  createLogger,
  generateDefaultQtPathsName,
  GlobalWorkspace,
  QtAdditionalPath,
  telemetry
} from 'qt-lib';
import { convertAdditionalQtPaths, getConfiguration } from '@/util';
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
  const info = coreAPI?.getQtInfo({ path: exePath });
  if (!info) {
    logger.error(`Failed to get Qt info for ${exePath}`);
    return;
  }
  const name = generateDefaultQtPathsName(info) + '_from_PATH';
  const qtPath: QtAdditionalPath = { path: exePath, name: name };
  const currentQtPaths = getCurrentGlobalAdditionalQtPaths();
  if (currentQtPaths.some((p) => p.path === qtPath.path)) {
    logger.info(`${qtPath.path} already exists in the settings`);
    return;
  }
  logger.info(`Added ${qtPath.path} to the settings with name: ${qtPath.name}`);
  addQtPathToSettings(qtPath);
  telemetry.sendConfig('qtpathsFromEnvPath');
}

export function addQtPathToSettings(qtPath: QtAdditionalPath) {
  const config = getConfiguration();
  const additionalQtPaths = config.inspect<(string | object)[]>(
    AdditionalQtPathsName
  );
  let valueToSet: (string | object)[] = [];
  const info = coreAPI?.getQtInfo(qtPath);
  if (!info) {
    throw new Error(`Failed to get Qt info for ${qtPath.path}`);
  }
  if (!qtPath.name) {
    qtPath.name = generateDefaultQtPathsName(info);
  }
  const valueToAdd = { name: qtPath.name, path: qtPath.path };
  if (additionalQtPaths?.globalValue) {
    additionalQtPaths.globalValue.push(valueToAdd);
    valueToSet = additionalQtPaths.globalValue;
  } else {
    logger.info(`${AdditionalQtPathsName} not found in the settings`);
    valueToSet = [valueToAdd];
  }
  logger.info(`Adding ${qtPath.path} to the settings`);
  void config.update(
    AdditionalQtPathsName,
    valueToSet,
    vscode.ConfigurationTarget.Global
  );
  const convertedValue = convertAdditionalQtPaths(valueToSet);
  onAdditionalQtPathsUpdated(convertedValue, GlobalWorkspace);
}

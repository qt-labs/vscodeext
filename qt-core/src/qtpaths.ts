// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import {
  AdditionalQtPathsName,
  createLogger,
  generateDefaultQtPathsName,
  GlobalWorkspace
} from 'qt-lib';
import { convertAdditionalQtPaths, getConfiguration } from '@/util';
import { onAdditionalQtPathsUpdated } from '@/installation-root';
import { coreAPI } from '@/extension';
import { EXTENSION_ID } from '@/constants';

const logger = createLogger('qtpaths');

export function registerQtByQtpaths() {
  return vscode.commands.registerCommand(
    `${EXTENSION_ID}.registerQtByQtpaths`,
    () => {
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
          addQtPathToSettings(selectedPath);
        }
      });
    }
  );
}

function addQtPathToSettings(qtPath: string) {
  const config = getConfiguration();
  const additionalQtPaths = config.inspect<(string | object)[]>(
    AdditionalQtPathsName
  );
  let valueToSet: (string | object)[] = [];
  const info = coreAPI?.getQtInfo({ path: qtPath });
  if (!info) {
    throw new Error(`Failed to get Qt info for ${qtPath}`);
  }
  const name = generateDefaultQtPathsName(info);
  const valueToAdd = { name: name, path: qtPath };
  if (additionalQtPaths?.globalValue) {
    additionalQtPaths.globalValue.push(valueToAdd);
    valueToSet = additionalQtPaths.globalValue;
  } else {
    logger.info(`${AdditionalQtPathsName} not found in the settings`);
    valueToSet = [valueToAdd];
  }
  logger.info(`Adding ${qtPath} to the settings`);
  void config.update(
    AdditionalQtPathsName,
    valueToSet,
    vscode.ConfigurationTarget.Global
  );
  const convertedValue = convertAdditionalQtPaths(valueToSet);
  onAdditionalQtPathsUpdated(convertedValue, GlobalWorkspace);
}

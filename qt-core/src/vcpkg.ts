// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as commandExists from 'command-exists';

import {
  createLogger,
  QtAdditionalPath,
  getVCPKGRoot,
  searchForQtPathsInVCPKG,
  telemetry
} from 'qt-lib';
import { getCurrentGlobalAdditionalQtPaths } from '@/installation-root';
import { EXTENSION_ID } from '@/constants';
import { addQtPathToSettings } from '@/qtpaths';

const logger = createLogger('vcpkg');

export function checkVcpkg() {
  if (getDoNotAskForVCPKG()) {
    logger.info('Do not ask for vcpkg');
    return;
  }
  if (!isVCPKGInstalled()) {
    logger.info('vcpkg is not installed');
    return;
  }
  const vcpkgRoot = getVCPKGRoot();
  if (!vcpkgRoot) {
    logger.error('VCPKG_ROOT not found');
    return;
  }
  const qtPath = searchForQtPathsInVCPKG(vcpkgRoot);
  if (qtPath) {
    // Ask for the user to add the paths to the settings
    const action = 'Use';
    const message = `Qt installation found in vcpkg. Do you want to use it?`;
    const doNotShowAgain = 'Do not show again';
    const currentQtPaths = getCurrentGlobalAdditionalQtPaths();
    if (containsQtPath(qtPath, currentQtPaths)) {
      logger.info('Qt path already exists in the settings');
      return;
    }
    void vscode.window
      .showInformationMessage(message, action, doNotShowAgain)
      .then((value) => {
        if (value === action) {
          telemetry.sendConfig('useVCPKG');
          logger.info('Adding Qt path to settings');
          addQtPathToSettings({ path: qtPath, isVCPKG: true });
        } else if (value === doNotShowAgain) {
          telemetry.sendConfig('doNotAskForVCPKG');
          void setDoNotAskForVCPKG(true);
          logger.info('setting doNotAskForVCPKG to true');
        }
      });
  }
}

function containsQtPath(qtPath: string, additionalQtPaths: QtAdditionalPath[]) {
  for (const p of additionalQtPaths) {
    if (p.path === qtPath) {
      return true;
    }
  }
  return false;
}

function isVCPKGInstalled(): boolean {
  if (commandExists.sync('vcpkg')) {
    return true;
  }
  return false;
}

function getDoNotAskForVCPKG(): boolean {
  return (
    vscode.workspace
      .getConfiguration(EXTENSION_ID)
      .get<boolean>('doNotAskForVCPKG') ?? false
  );
}

async function setDoNotAskForVCPKG(value: boolean) {
  await vscode.workspace
    .getConfiguration(EXTENSION_ID)
    .update('doNotAskForVCPKG', value, vscode.ConfigurationTarget.Global);
}

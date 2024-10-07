// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import * as vscode from 'vscode';
import * as commandExists from 'command-exists';

import {
  createLogger,
  IsLinux,
  IsMacOS,
  IsWindows,
  OSExeSuffix,
  QtAdditionalPath,
  getVCPKGRoot,
  IsArm64,
  Isx64
} from 'qt-lib';
import { getQueryOutput } from '@/util';
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
          logger.info('Adding Qt path to settings');
          addQtPathToSettings({ path: qtPath, isVCPKG: true });
        } else if (value === doNotShowAgain) {
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

export function isVCPKGInstalled(): boolean {
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

export async function setDoNotAskForVCPKG(value: boolean) {
  await vscode.workspace
    .getConfiguration(EXTENSION_ID)
    .update('doNotAskForVCPKG', value, vscode.ConfigurationTarget.Global);
}

export function searchForQtPathsInVCPKG(root: string): string | undefined {
  if (!root) {
    return;
  }
  const exeNames = [`qtpaths${OSExeSuffix}`, `qmake${OSExeSuffix}`];
  if (IsWindows) {
    exeNames.push('qmake.bat');
  }

  const osPath = () => {
    const arch = Isx64 ? 'x64' : 'x86';
    if (IsLinux) {
      return `${arch}-linux`;
    } else if (IsMacOS) {
      if (IsArm64) {
        return 'arm64-osx';
      } else {
        return `x64-osx`;
      }
    } else if (IsWindows) {
      return `${arch}-windows`;
    } else {
      throw new Error('Not supported');
    }
  };
  for (const exeName of exeNames) {
    const exePath = path.join(
      root,
      'installed',
      osPath(),
      'tools',
      'Qt6',
      'bin',
      exeName
    );
    const ret = getQueryOutput(exePath);
    if (ret) {
      logger.info(`Found Qt paths in vcpkg: ${exePath}`);
      return exePath;
    }
  }
  return undefined;
}

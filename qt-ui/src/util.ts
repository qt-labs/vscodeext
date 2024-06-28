// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as path from 'path';

import * as constants from '@/constants';
import {
  IsMacOS,
  IsWindows,
  PlatformExecutableExtension,
  exists
} from 'qt-lib';

export function getConfig<T>(
  key: string,
  defaultValue: T,
  folder?: vscode.WorkspaceFolder
): T {
  return vscode.workspace
    .getConfiguration(constants.EXTENSION_ID, folder)
    .get<T>(key, defaultValue);
}

export function affectsConfig(
  event: vscode.ConfigurationChangeEvent,
  key: string,
  folder?: vscode.WorkspaceFolder
): boolean {
  return event.affectsConfiguration(`${constants.EXTENSION_ID}.${key}`, folder);
}

export async function waitUntilExtensionReady(extensionId: string) {
  const promiseActivateCMake = vscode.extensions
    .getExtension(extensionId)
    ?.activate();
  await promiseActivateCMake;
}

export async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const DesignerExeName = IsMacOS
  ? 'Designer'
  : 'designer' + PlatformExecutableExtension;

export async function locateQtDesignerExePath(selectedQtPath: string) {
  const getDesignerExePath = (selectedQtBinPath: string) => {
    const macOSPath = path.join(
      'Designer.app',
      'Contents',
      'MacOS',
      DesignerExeName
    );
    return IsMacOS
      ? path.join(selectedQtBinPath, macOSPath)
      : path.join(selectedQtBinPath, DesignerExeName);
  };
  let designerExePath = getDesignerExePath(path.join(selectedQtPath, 'bin'));
  if (await exists(designerExePath)) {
    return designerExePath;
  }

  // const hostBinDir = await queryHostBinDirPath(selectedQtPath);
  // designerExePath = getDesignerExePath(hostBinDir);
  // if (await exists(designerExePath)) {
  //   return designerExePath;
  // }

  if (!IsWindows) {
    designerExePath = '/usr/bin/designer';
    if (await exists(designerExePath)) {
      return designerExePath;
    }
  }

  return '';
}

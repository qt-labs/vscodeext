// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as path from 'path';

import * as constants from '@/constants';
import {
  IsMacOS,
  IsWindows,
  OSExeSuffix,
  exists,
  searchForExeInQtInfo,
  locateQtPathsExeKitPath
} from 'qt-lib';
import { coreAPI } from '@/extension';

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

export async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const DesignerExeName = IsMacOS ? 'Designer' : 'designer' + OSExeSuffix;

function getDesignerExePathFromBin(selectedQtBinPath: string) {
  const macOSPath = path.join(
    'Designer.app',
    'Contents',
    'MacOS',
    DesignerExeName
  );
  return IsMacOS
    ? path.join(selectedQtBinPath, macOSPath)
    : path.join(selectedQtBinPath, DesignerExeName);
}

export async function locateDesignerFromKit(
  selectedKitPath: string,
  qtPathsFallback = true
) {
  let designerExePath = getDesignerExePathFromBin(
    path.join(selectedKitPath, 'bin')
  );
  if (await exists(designerExePath)) {
    return designerExePath;
  }
  if (qtPathsFallback) {
    const qtPaths = await locateQtPathsExeKitPath(selectedKitPath);
    if (qtPaths) {
      const qtPathsExePath = await locateDesignerFromQtPaths(qtPaths);
      if (qtPathsExePath) {
        return qtPathsExePath;
      }
    }
  }

  if (!IsWindows) {
    designerExePath = '/usr/bin/designer';
    if (await exists(designerExePath)) {
      return designerExePath;
    }
  }

  return undefined;
}

export async function locateDesignerFromQtPaths(qtPaths: string) {
  const info = coreAPI?.getQtInfoFromPath(qtPaths);
  if (!info) {
    return undefined;
  }
  const designerExePath = await searchForExeInQtInfo(
    info,
    getDesignerExePathFromBin
  );
  if (designerExePath) {
    return designerExePath;
  }
  return undefined;
}

// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';

import {
  getQtInsRoot,
  getQtPathsExe,
  getSelectedKit,
  IsQtKit
} from '@/commands/register-qt-path';
import { coreAPI } from '@/extension';
import { Kit } from '@/kit-manager';

/**
 * Returns true if the extension is currently running tests.
 */
export function isTestMode(): boolean {
  return process.env.QT_TESTING === '1';
}

export function getFilenameWithoutExtension(filename: string): string {
  const separatedPath = filename.split(path.sep).pop();
  if (!separatedPath) {
    throw new Error('Filename is empty');
  }
  const splitPath = separatedPath.split('.')[0];
  if (splitPath === undefined) {
    throw new Error('Filename is empty');
  }

  return splitPath;
}

export function QtVersionFromKit(kit: Kit) {
  const qtInsRoot = getQtInsRoot(kit);
  if (qtInsRoot) {
    const split = qtInsRoot.split(path.sep);
    return split[split.length - 2];
  }
  const qtPathsExe = getQtPathsExe(kit);
  if (qtPathsExe) {
    const qtInfo = coreAPI?.getQtInfoFromPath(qtPathsExe);
    return qtInfo?.get('QT_VERSION');
  }
  return undefined;
}

export async function getMajorQtVersion() {
  const kit = await getSelectedKit();
  if (!kit || !IsQtKit(kit)) {
    return undefined;
  }
  const version = QtVersionFromKit(kit);
  if (version) {
    const majorVersion = version.split('.')[0];
    return majorVersion;
  }
  return undefined;
}

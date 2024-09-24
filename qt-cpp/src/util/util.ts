// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';

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
  const splittedPath = separatedPath.split('.')[0];
  if (splittedPath === undefined) {
    throw new Error('Filename is empty');
  }

  return splittedPath;
}

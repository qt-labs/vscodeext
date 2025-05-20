// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs/promises';
import * as path from 'path';

import { qtcliExeName, isValidQtcliPath, logger, errorString } from './common';

export class QtcliExeFinder {
  private readonly _dirCandidates: string[] = [];
  private readonly _distDirs: string[] = [];

  public addPossibleDir(dirs: string | string[]) {
    if (typeof dirs === 'string') {
      this._dirCandidates.push(dirs);
    } else {
      this._dirCandidates.push(...dirs);
    }
  }

  public addDistDir(dir: string) {
    this._distDirs.push(dir);
  }

  public async run() {
    try {
      for (const dir of this._dirCandidates) {
        const fullPath = await findQtcliIn(dir);
        if (fullPath) {
          return fullPath;
        }
      }

      const prefix = findQtcliOsPrefix();

      for (const distDir of this._distDirs) {
        const fullPath = await findQtcliInDist(distDir, prefix);
        if (fullPath) {
          return fullPath;
        }
      }
    } catch (e) {
      logger.error('cannot run qtcli:', errorString(e));
    }

    return undefined;
  }
}

function findQtcliOsPrefix(): string {
  const platform = process.platform;

  if (platform === 'win32') {
    return 'qtcli-windows-';
  } else if (platform === 'darwin' || platform === 'linux') {
    return `qtcli-${platform}-`;
  } else {
    throw new Error(`Platform '${platform}' is not supported`);
  }
}

async function findQtcliIn(dir: string) {
  try {
    const files = await fs.readdir(dir, { withFileTypes: true });

    for (const file of files) {
      if (file.isFile() && file.name === qtcliExeName) {
        const fullPath = path.join(dir, file.name);
        if (isValidQtcliPath(fullPath)) {
          return fullPath;
        }
      }
    }
  } catch (e) {
    return undefined;
  }

  return undefined;
}

async function findQtcliInDist(distDir: string, prefix: string) {
  try {
    const entries = await fs.readdir(distDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith(prefix)) {
        const fullPath = path.join(distDir, entry.name, qtcliExeName);
        if (isValidQtcliPath(fullPath)) {
          return fullPath;
        }
      }
    }
  } catch (e) {
    return undefined;
  }

  return undefined;
}

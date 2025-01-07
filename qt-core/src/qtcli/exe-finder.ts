// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs/promises';
import * as path from 'path';

import { isValidQtcliPath, logger, errorString } from './common';

export class QtcliExeFinder {
  private readonly _dirCandidates: string[] = [];

  public addPossibleDir(dirs: string | string[]) {
    if (typeof dirs === 'string') {
      this._dirCandidates.push(dirs);
    } else {
      this._dirCandidates.push(...dirs);
    }
  }

  public async run() {
    try {
      const prefix = findQtcliPrefix();

      for (const dir of this._dirCandidates) {
        const fullPath = await findQtcliIn(dir, prefix);
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

function findQtcliPrefix(): string {
  const platform = process.platform;

  if (platform === 'win32') {
    return 'qtcli_windows';
  } else if (platform === 'darwin') {
    return 'qtcli_macos';
  } else if (platform === 'linux') {
    return 'qtcli_ubuntu';
  } else {
    throw new Error(`Platform '${platform}' is not supported`);
  }
}

async function findQtcliIn(dir: string, prefix: string) {
  try {
    const files = await fs.readdir(dir, { withFileTypes: true });

    for (const file of files) {
      if (file.isFile() && file.name.startsWith(prefix)) {
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

// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';

import { host } from './util';
import { spawnSync } from 'child_process';

export function getQueryOutput(exePath: string) {
  const ret = spawnSync(exePath, ['-query'], {
    encoding: 'utf8',
    timeout: 1000
  });
  if (ret.error ?? ret.status !== 0) {
    return undefined;
  }
  return ret;
}

export function searchForQtPathsInVCPKG(root: string): string | undefined {
  if (!root) {
    return;
  }
  const exeNames = [`qtpaths${host.exeSuffix}`, `qmake${host.exeSuffix}`];
  if (host.isWindows) {
    exeNames.push('qmake.bat');
  }

  const osPath = () => {
    const arch = host.isX64 ? 'x64' : 'x86';
    if (host.isLinux) {
      return `${arch}-linux`;
    } else if (host.isMacOS) {
      if (host.isArm64) {
        return 'arm64-osx';
      } else {
        return `x64-osx`;
      }
    } else if (host.isWindows) {
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
      return exePath;
    }
  }
  return undefined;
}

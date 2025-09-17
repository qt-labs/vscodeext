// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as cp from 'child_process';

export function parseVSCodeDirs(cliArgs: string[]) {
  const pick = (key: string) => {
    const pref = `${key}=`;
    const hit = cliArgs.find((a) => a.startsWith(pref));
    return hit ? hit.slice(pref.length) : undefined;
  };
  return {
    userDataDir: pick('--user-data-dir'),
    extensionsDir: pick('--extensions-dir')
  };
}

export function installExtensionWithRetry(
  cli: string,
  baseArgs: string[],
  idOrVsix: string,
  attempts = 3
) {
  for (let i = 1; i <= attempts; i++) {
    const res = cp.spawnSync(
      cli,
      [
        ...baseArgs,
        '--install-extension',
        idOrVsix,
        '--force',
        '--log',
        'trace'
      ],
      {
        // IMPORTANT: don't force ELECTRON_RUN_AS_NODE here
        encoding: 'utf-8',
        stdio: 'inherit',
        shell: process.platform === 'win32' // makes .cmd more reliable on Windows
      }
    );
    if (res.status === 0) {
      return;
    }

    console.error(
      `[runTest] install "${idOrVsix}" failed (attempt ${i}/${attempts})`
    );
    if (i < attempts) {
      try {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, i * 1000);
      } catch (err) {
        console.debug(
          '[runTest] Atomics.wait not available:',
          (err as Error).message
        );
      }
    }
  }
  console.error(`[runTest] Giving up installing "${idOrVsix}"`);
  process.exit(1);
}

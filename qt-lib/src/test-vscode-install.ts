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
    const cleanEnv = { ...process.env };
    delete (cleanEnv as Record<string, unknown>).ELECTRON_RUN_AS_NODE;

    const res = cp.spawnSync(
      cli,
      [...baseArgs, '--install-extension', idOrVsix, '--force'],
      {
        encoding: 'utf-8',
        // Keep output quiet unless you want to debug:
        stdio: process.env.VS_LOG_VERBOSE ? 'inherit' : 'pipe',
        shell: process.platform === 'win32',
        env: cleanEnv, 
      }
    );
    if (res.status === 0) {
      return;
    }

    // If muted, print what we captured
    if (res.stdout) {
      console.error(res.stdout);
    }
    if (res.stderr) {
      console.error(res.stderr);
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

/**
 * Print the installed extensions (only when DEBUG=1).
 * Never fails the run; strictly diagnostic.
 */
export function debugListExtensions(cli: string, baseArgs: string[]): void {
  if (process.env.DEBUG !== '1') { return; }

  const res = cp.spawnSync(
    cli,
    [...baseArgs, '--list-extensions', '--show-versions'],
    { encoding: 'utf-8', shell: process.platform === 'win32' }
  );

  const out = (res.stdout || '').toString().trim();
  console.log('[debug] --list-extensions --show-versions:\n' + (out || '<empty>'));
}

/**
 * Hard-assert that required extension IDs are installed.
 * Fails fast with exit(1) if any are missing.
 */
export function assertExtensionsInstalled(
  cli: string,
  baseArgs: string[],
  requiredIds: string[]
): void {
  const res = cp.spawnSync(
    cli,
    [...baseArgs, '--list-extensions'],
    { encoding: 'utf-8', shell: process.platform === 'win32' }
  );

  const list = (res.stdout || '').toString().toLowerCase();
  const missing = requiredIds.filter(id => !list.includes(id.toLowerCase()));
  if (missing.length) {
    console.error('[runTest] Missing required extensions:', missing.join(', '));
    process.exit(1);
  }
}


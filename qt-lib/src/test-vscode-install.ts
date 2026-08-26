// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Directory holding the VS Code build that the extension-host tests run
 * against, shared by every package in the repository.
 *
 * @vscode/test-electron roots its default cache at process.cwd(), and the
 * test scripts run from <package>/out/test, so each package otherwise
 * downloads and extracts its own copy of VS Code. Pointing them all at one
 * directory turns nine downloads into one, which is most of the wall-clock
 * time and disk footprint of a CI test job.
 *
 * Only the VS Code build itself is shared. The extensions and user-data
 * directories still come from the library's cwd-based default, so each
 * package keeps its own profile and cannot see extensions installed by
 * another package's run.
 *
 * Set VSCODE_TEST_CACHE_PATH to override, for example to a directory that CI
 * restores from its own cache.
 */
export function getSharedVSCodeCachePath(extensionRoot: string): string {
  const fromEnv = process.env.VSCODE_TEST_CACHE_PATH?.trim();
  return fromEnv
    ? path.resolve(fromEnv)
    : path.resolve(extensionRoot, '..', '.vscode-test');
}

/**
 * A cached build is reused whenever its "is-complete" marker file is
 * present, so an extraction that was interrupted after the marker was
 * written hands back a path to a binary that is not there. That surfaces
 * much later as an opaque "spawn ... ENOENT" when the tests launch VS Code.
 * Fail here instead, where the cause and the remedy are obvious.
 */
export function assertVSCodeExecutable(
  executablePath: string,
  cachePath: string
): void {
  if (!fs.existsSync(executablePath)) {
    throw new Error(
      `The downloaded VS Code is incomplete: "${executablePath}" does not ` +
        `exist. Remove "${cachePath}" and run the tests again.`
    );
  }
}

export interface ExtensionInstallInfo {
  idOrVsix: string;
  preRelease?: boolean;
}

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
  ext: ExtensionInstallInfo,
  attempts = 3
) {
  for (let i = 1; i <= attempts; i++) {
    const cleanEnv = { ...process.env };
    delete (cleanEnv as Record<string, unknown>).ELECTRON_RUN_AS_NODE;
    const args = [...baseArgs, '--install-extension', ext.idOrVsix, '--force'];
    if (ext.preRelease) {
      args.push('--pre-release');
    }
    const res = cp.spawnSync(cli, args, {
      encoding: 'utf-8',
      // Keep output quiet unless you want to debug:
      stdio: process.env.VS_LOG_VERBOSE ? 'inherit' : 'pipe',
      shell: process.platform === 'win32',
      env: cleanEnv
    });
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
      `[runTest] install "${ext.idOrVsix}" failed (attempt ${i.toString()}/${attempts.toString()})`
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
  console.error(`[runTest] Giving up installing "${ext.idOrVsix}"`);
  process.exit(1);
}

/**
 * Returns the numeric debug level from process.env.QT_TEST_DEBUG .
 *
 * - Defaults to 0 if not set or invalid.
 * - Example: QT_TEST_DEBUG =2 → returns 2
 */
export function getDebugLevel(): number {
  const raw = process.env.QT_TEST_DEBUG;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}
/**
 * Print the installed extensions (only when DEBUG=1).
 * Never fails the run; strictly diagnostic.
 */
export function debugListExtensions(cli: string, baseArgs: string[]): void {
  if (getDebugLevel() < 1) {
    return;
  }

  const res = cp.spawnSync(
    cli,
    [...baseArgs, '--list-extensions', '--show-versions'],
    { encoding: 'utf-8', shell: process.platform === 'win32' }
  );

  const out = (res.stdout || '').toString().trim();
  console.log(
    '[debug] --list-extensions --show-versions:\n' + (out || '<empty>')
  );
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
  const res = cp.spawnSync(cli, [...baseArgs, '--list-extensions'], {
    encoding: 'utf-8',
    shell: process.platform === 'win32'
  });

  const list = (res.stdout || '').toString().toLowerCase();
  const missing = requiredIds.filter((id) => !list.includes(id.toLowerCase()));
  if (missing.length) {
    console.error('[runTest] Missing required extensions:', missing.join(', '));
    process.exit(1);
  }
}

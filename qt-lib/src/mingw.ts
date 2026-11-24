// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs';
import * as path from 'path';

import { compareVersions } from './util';

/**
 * Matches the folder of a MinGW build of Qt, for example `mingw_64`,
 * `mingw81_32` or `mingw1510-x86_64`. Group 1 = the digits of the MinGW
 * version, empty when the folder does not name it. Group 2 = the
 * architecture.
 */
const MingwQtBuildRegexp = /^mingw(\d*)[_-](.+)$/i;

/**
 * Matches a MinGW toolchain in the `Tools` folder of a Qt Online Installer
 * installation, for example `mingw1310_64`. Group 1 = the digits of its
 * version, group 2 = its architecture.
 */
const MingwToolsDirRegexp = /^mingw(\d+)_(\d+)$/i;

/** How many folders above a Qt build its `Tools` folder is looked for. */
const ToolsDirSearchDepth = 3;

/**
 * Whether a Qt installation is a MinGW build, going by the name of its
 * folder like `getMsvcInfo()` does for MSVC.
 */
export function isMingwQtBuild(qtPrefix: string): boolean {
  return MingwQtBuildRegexp.test(path.basename(qtPrefix));
}

/**
 * The `bin` folder of the MinGW toolchain to build with against the MinGW
 * build of Qt in `qtPrefix`. Such a Qt cannot be built against with another
 * compiler, and the Qt toolchain file does not tell CMake which one to use,
 * so whoever configures the project has to name it.
 *
 * Looked for, in this order:
 *  - the toolchain in `sharedMingw` with the version the Qt build names, as
 *    `mingw1510-x86_64` does for MinGW 15.1.0
 *  - the toolchain in the `Tools` folder above the Qt build, where the Qt
 *    Online Installer puts it
 *  - the newest toolchain in `sharedMingw`
 *
 * @param sharedMingw `QtToolsPaths.mingw`, as shared by qt-sm.
 */
export function findMingwBinDir(
  qtPrefix: string,
  sharedMingw?: Record<string, string>
): string | undefined {
  const match = MingwQtBuildRegexp.exec(path.basename(qtPrefix));
  const digits = match?.[1] ?? '';
  const shared = Object.entries(sharedMingw ?? {});

  if (digits) {
    const named = shared.find(
      ([version]) => version.replace(/\D/g, '') === digits
    );
    if (named) {
      return named[1];
    }
  }

  let dir = qtPrefix;
  for (let i = 0; i < ToolsDirSearchDepth; i++) {
    dir = path.dirname(dir);
    const binDir = findMingwBinDirInTools(
      path.join(dir, 'Tools'),
      digits,
      match?.[2]
    );
    if (binDir) {
      return binDir;
    }
  }

  return shared.sort(([a], [b]) => compareVersions(b, a))[0]?.[1];
}

/**
 * The `bin` folder of the newest MinGW toolchain in `toolsDir` that fits a
 * Qt build with the given version digits and architecture.
 */
function findMingwBinDirInTools(
  toolsDir: string,
  digits: string,
  arch: string | undefined
): string | undefined {
  let names: string[];
  try {
    names = fs.readdirSync(toolsDir);
  } catch {
    // Most folders above a Qt build have no Tools folder.
    return undefined;
  }

  const toolchains: { digits: string; binDir: string }[] = [];
  for (const name of names) {
    const toolchain = MingwToolsDirRegexp.exec(name);
    if (!toolchain?.[1]) {
      continue;
    }
    // A 32-bit build of Qt needs the 32-bit toolchain, and a 64-bit one the
    // 64-bit toolchain.
    if ((arch === '32' || arch === '64') && toolchain[2] !== arch) {
      continue;
    }
    const binDir = path.join(toolsDir, name, 'bin');
    if (fs.existsSync(path.join(binDir, 'g++.exe'))) {
      toolchains.push({ digits: toolchain[1], binDir });
    }
  }

  // Qt 5 names the toolchain in the folder of the build, without the patch
  // version: `mingw81_64` goes with `mingw810_64`.
  const named = toolchains.filter(
    (toolchain) => digits && toolchain.digits.startsWith(digits)
  );
  const candidates = named.length > 0 ? named : toolchains;
  candidates.sort((a, b) => Number(b.digits) - Number(a.digits));
  return candidates[0]?.binDir;
}

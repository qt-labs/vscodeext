// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';

/**
 * Maps MSVC platform identifiers (from CMake kits) to Qt's architecture
 * suffix (e.g. '64', '32').
 */
export const MsvcPlatformToQtArch: Record<string, string> = {
  x64: '64',
  amd64_x86: '32',
  x86_amd64: '64',
  amd64: '64',
  win32: '32',
  x86: '32',
  x86_64: '64',
  i386: '32',
  arm64: '64'
};

/**
 * Maps Qt's architecture suffix to CMake architecture value.
 */
export const QtArchToCMakeArch: Record<string, string> = {
  '64': 'x64',
  '32': 'x86',
  arm64: 'ARM64'
};

/**
 * Bidirectional mapping between VS major version number and its marketing year.
 */
export const VsVersionToYear: Record<string, string> = {
  '14': '2015',
  '15': '2017',
  '16': '2019',
  '17': '2022'
};

export const VsYearToVersion: Record<string, string> = {
  '2015': '14',
  '2017': '15',
  '2019': '16',
  '2022': '17'
};

/**
 * Maps VS major version (from kit name like "VisualStudio.17.0") to its year.
 */
export const VsMajorVersionToYear: Record<string, string> = {
  '11': '2008',
  '12': '2010',
  '13': '2012',
  ...VsVersionToYear
};

/** Matches `msvcYEAR_ARCH` (e.g. `msvc2022_64`). Group 1 = year, group 2 = arch. */
export const MsvcToolchainRegexp = /msvc(\d{4})_(.+)/;

/** Matches `msvcYEAR` without arch suffix (e.g. `msvc2022`). Group 1 = year. */
export const MsvcToolchainNoArchRegexp = /msvc(\d{4})/;

/** Matches a 4-digit year surrounded by spaces in a kit name. */
export const MsvcYearInNameRegexp = / (\d{4}) /;

/** Matches `VisualStudio.XX.Y` and captures the major version XX. */
export const VsMajorVersionRegexp = /VisualStudio\.(\d{2})\.\d /;

export interface MsvcInfo {
  arch: string;
  year: string;
  vsGenerator: string;
}

/**
 * Extracts MSVC info from a Qt installation path by parsing its basename
 * (e.g. `msvc2022_64`).
 *
 * @returns `MsvcInfo` with architecture, year, and VS generator string,
 *          or `undefined` if the path doesn't represent an MSVC installation.
 */
export function getMsvcInfo(installationPath: string): MsvcInfo | undefined {
  const toolchain = path.basename(installationPath);
  if (!toolchain.startsWith('msvc')) {
    return undefined;
  }
  const match =
    MsvcToolchainRegexp.exec(toolchain) ??
    MsvcToolchainNoArchRegexp.exec(toolchain);
  if (!match) {
    return undefined;
  }
  const year = match[1] ?? '2022';
  const archStr = match[2] ?? '64';
  const arch = QtArchToCMakeArch[archStr] ?? 'x64';
  const vsVersion = VsYearToVersion[year];
  if (!vsVersion) {
    return undefined;
  }
  return {
    arch,
    year,
    vsGenerator: `Visual Studio ${vsVersion} ${year}`
  };
}

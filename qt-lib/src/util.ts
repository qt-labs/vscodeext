// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as child_process from 'child_process';

import { QtInfo } from './core-api';

export const Home = os.homedir();
export const IsWindows = process.platform === 'win32';
export const IsMacOS = process.platform === 'darwin';
export const IsLinux = process.platform === 'linux';
export const IsUnix = IsMacOS || IsLinux;
export const IsArm64 = os.arch() === 'arm64';
export const IsArm32 = os.arch() === 'arm';
export const Isx86 = os.arch() === 'x86' || os.arch() === 'ia32';
export const Isx64 = os.arch() === 'x64';

export const OSExeSuffix = IsWindows ? '.exe' : '';
export const UserLocalDir = IsWindows
  ? process.env.LOCALAPPDATA ?? ''
  : path.join(Home, '.local/share');

export async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function exists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function existing(filePath: string) {
  try {
    await fs.access(filePath);
    return filePath;
  } catch {
    return '';
  }
}

export function askForKitSelection() {
  void vscode.window
    .showInformationMessage(
      'No CMake kit selected. Please select a CMake kit.',
      ...['Select CMake Kit']
    )
    .then((selection) => {
      if (selection === 'Select CMake Kit') {
        void vscode.commands.executeCommand('cmake.selectKit');
      }
    });
}

export function isMultiWorkspace(): boolean {
  return vscode.workspace.workspaceFile !== undefined;
}

export async function queryHostBinDirPath(
  selectedQtPath: string
): Promise<string> {
  const qmakeExePath = await locateQmakeExeFilePath(selectedQtPath);
  const childProcess = child_process.exec(
    qmakeExePath + ' -query QT_HOST_BINS'
  );
  const promiseFirstLineOfOutput = new Promise<string>((resolve, reject) => {
    childProcess.stdout?.on('data', (data: string) => {
      resolve(data.toString().trim());
    });
    childProcess.stderr?.on('data', (data: string) => {
      reject(new Error(data.toString().trim()));
    });
  });
  const promiseProcessClose = new Promise<string>((resolve, reject) => {
    childProcess.on('close', () => {
      resolve('');
    });
    childProcess.on('error', (err) => {
      reject(err);
    });
  });
  const hostBinDir = await Promise.race([
    promiseFirstLineOfOutput,
    promiseProcessClose
  ]);
  return hostBinDir;
}

export async function locateQmakeExeFilePath(selectedQtPath: string) {
  return (
    (await existing(path.join(selectedQtPath, 'bin', 'qmake' + OSExeSuffix))) ||
    (await existing(path.join(selectedQtPath, 'bin', 'qmake6' + OSExeSuffix)))
  );
}

export function compareVersions(version1: string, version2: string) {
  if (version1 == version2) {
    return 0;
  }
  const v1parts = version1.split('.');
  const v2parts = version2.split('.');

  for (let i = 0; i < v1parts.length; ++i) {
    if (v2parts.length === i) {
      return 1;
    }
    const v1Part = v1parts[i];
    const v2Part = v2parts[i];
    if (v1Part === undefined) {
      throw new Error('v1Part is undefined');
    }
    if (v2Part === undefined) {
      throw new Error('v2Part is undefined');
    }
    if (v1Part === v2Part) {
      continue;
    }
    if (v1Part > v2Part) {
      return 1;
    }
    return -1;
  }

  if (v1parts.length !== v2parts.length) {
    return -1;
  }

  return 0;
}

export async function findQtKits(dir: string): Promise<string[]> {
  if (!dir || !fsSync.existsSync(dir)) {
    return [];
  }
  const qtKits: string[] = [];
  const items = await fs.readdir(dir, { withFileTypes: true });
  for (const item of items) {
    if (item.isDirectory() && matchesVersionPattern(item.name)) {
      const kitItemPath = path.join(dir, item.name);
      const kitItemDirContent = await fs.readdir(kitItemPath, {
        withFileTypes: true
      });
      for (const subitem of kitItemDirContent) {
        if (subitem.isDirectory() && subitem.name.toLowerCase() != 'src') {
          const subdirFullPath = path.join(kitItemPath, subitem.name);
          const binPath = path.join(subdirFullPath, 'bin'); // TODO don't hard-code 'bin'
          let qtConfFound = false;
          for (const fileName of ['qt.conf', 'target_qt.conf']) {
            const qtConfPath = path.join(binPath, fileName);
            if (await exists(qtConfPath)) {
              qtKits.push(subdirFullPath);
              qtConfFound = true;
              break;
            }
          }
          if (!qtConfFound) {
            console.error(
              `Neither qt.conf nor target_qt.conf were found in '${subdirFullPath}'.`
            );
          }
        }
      }
    }
  }
  return qtKits;
}

export function isError<T>(e: T): e is T & Error {
  return e instanceof Error;
}

export function matchesVersionPattern(installationPath: string): boolean {
  // Check if the first character of the path is a digit (0-9)
  return /^([0-9]+\.)+/.test(installationPath);
}

export function isPathToQtPathsOrQMake(filePath: string): boolean {
  return filePath.match(/(qtpaths|qmake)[0-9]?(\.(exe|bat))?$/) ? true : false;
}

export function isEqualArrays<T>(a: T[], b: T[]): boolean {
  return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
}

function deepEqual<T>(x: T, y: T): boolean {
  if (x === y) {
    return true;
  }

  if (
    typeof x !== 'object' ||
    x === null ||
    typeof y !== 'object' ||
    y === null
  ) {
    return false;
  }

  const keysX = Object.keys(x as never);
  const keysY = Object.keys(y as never);

  if (keysX.length !== keysY.length) {
    return false;
  }

  for (const key of keysX) {
    if (
      !keysY.includes(key) ||
      !deepEqual((x as never)[key], (y as never)[key])
    ) {
      return false;
    }
  }

  return true;
}

export function generateDefaultQtPathsName(qtInfo: QtInfo): string {
  const qtVersion = qtInfo.get('QT_VERSION');
  const targetMkSpec = qtInfo.get('QMAKE_XSPEC');
  return 'Qt-' + qtVersion + '-' + targetMkSpec;
}

// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as child_process from 'child_process';

export const Home = os.homedir();
export const IsWindows = process.platform === 'win32';
export const IsMacOS = process.platform === 'darwin';
export const IsLinux = process.platform === 'linux';

export const PlatformExecutableExtension = IsWindows ? '.exe' : '';
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
    (await existing(
      path.join(selectedQtPath, 'bin', 'qmake' + PlatformExecutableExtension)
    )) ||
    (await existing(
      path.join(selectedQtPath, 'bin', 'qmake6' + PlatformExecutableExtension)
    ))
  );
}

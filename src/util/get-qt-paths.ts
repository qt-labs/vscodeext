// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';

import { Home, IsMacOS, IsWindows } from '@util/os';
import * as fsutil from '@util/fs';
import { getSelectedQtInstallationPath } from '@cmd/register-qt-path';

export const PlatformExecutableExtension = IsWindows ? '.exe' : '';
export const UserLocalDir = IsWindows
  ? process.env.LOCALAPPDATA ?? ''
  : path.join(Home, '.local/share');

const QmakeFileName = 'qmake' + PlatformExecutableExtension;
const DesignerExeName = IsMacOS
  ? 'Designer'
  : 'designer' + PlatformExecutableExtension;
const QtToolchainCMakeFileName = 'qt.toolchain.cmake';
const NinjaFileName = 'ninja' + PlatformExecutableExtension;

export function matchesVersionPattern(installationPath: string): boolean {
  // Check if the first character of the path is a digit (0-9)
  return /^([0-9]+\.)+/.test(installationPath);
}

async function pathOfDirectoryIfExists(
  dirPath: string
): Promise<string | undefined> {
  try {
    await fs.access(dirPath);
    return path.normalize(dirPath);
  } catch (error) {
    return undefined;
  }
}

function qtToolsDirByQtRootDir(qtRootDir: string): string {
  return path.normalize(path.join(qtRootDir, 'Tools'));
}

export function mangleQtInstallation(
  qtFolder: string,
  installation: string
): string {
  installation = installation.replace(qtFolder, '');
  const pathParts = installation.split(/[/\\:]+/).filter((n) => n);
  pathParts.unshift(path.basename(qtFolder));
  return pathParts.slice().join('-');
}

export function mangleMsvcKitName(installation: string): string {
  const pathParts = installation.split(/[/\\:]+/).filter((n) => n);
  const qtIdx = Math.max(
    0,
    pathParts.findIndex((s) => s.toLowerCase() == 'qt')
  );
  return pathParts.slice(qtIdx).join('-');
}

async function locateQmakeExeFilePath(selectedQtPath: string) {
  const bin = path.join(selectedQtPath, 'bin');
  const qmakeExePath = path.join(bin, QmakeFileName);
  return (
    (await fsutil.existing(qmakeExePath)) ||
    (await fsutil.existing(QmakeFileName)) ||
    (await fsutil.existing(path.join(bin, 'qmake'))) ||
    (await fsutil.existing('qmake'))
  );
}

export async function locateNinjaExecutable(qtRootDir: string) {
  const pathsToCheck = [
    path.join(qtToolsDirByQtRootDir(qtRootDir), 'Ninja', NinjaFileName)
  ];
  const vs2022dir = process.env.VS2022INSTALLDIR;
  if (vs2022dir) {
    pathsToCheck.push(
      path.join(
        vs2022dir,
        'Common7',
        'IDE',
        'CommonExtensions',
        'Microsoft',
        'CMake',
        'Ninja',
        NinjaFileName
      ),
      path.join(vs2022dir, 'MSBuild', 'Google', 'Android', 'bin', NinjaFileName)
    );
  }
  for (const checkPath of pathsToCheck) {
    if (await fsutil.exists(checkPath)) {
      return checkPath;
    }
  }

  return '';
}

export async function locateMingwBinDirPath(qtRootDir: string) {
  // TODO: check if g++ exists in PATH already
  const qtToolsDir = qtToolsDirByQtRootDir(qtRootDir);
  const items = await fs.readdir(qtToolsDir, { withFileTypes: true });
  const mingws = items.filter((item) =>
    item.name.toLowerCase().startsWith('mingw')
  );
  const promiseMingwsWithBinDirs = mingws.map(async (item) =>
    pathOfDirectoryIfExists(path.join(qtToolsDir, item.name, 'bin'))
  );
  const mingwsWithBins = (await Promise.all(promiseMingwsWithBinDirs)).filter(
    Boolean
  ) as string[];
  const mingwVersions = new Map<number, string>(
    mingwsWithBins.map((item) => {
      const m = item.match(/mingw(\d+)_\d+/);
      let v = 0;
      if (m?.[1] !== undefined) {
        v = parseInt(m[1], 10);
      }
      return [v, item];
    })
  );

  const highestMingWVersion = Math.max(...mingwVersions.keys());
  return mingwVersions.get(highestMingWVersion);
}

export async function locateCMakeQtToolchainFile(installation: string) {
  const libCMakePath = path.join(installation, 'lib', 'cmake');
  const qtVersions = ['Qt6', 'Qt5', 'Qt'];

  for (const qtVersion of qtVersions) {
    const cmakeQtToolchainFilePath = path.join(
      libCMakePath,
      qtVersion,
      QtToolchainCMakeFileName
    );
    if (await fsutil.exists(cmakeQtToolchainFilePath)) {
      return cmakeQtToolchainFilePath;
    }
  }

  return '';
}

export function qtRootByQtInstallation(installation: string) {
  return path.normalize(path.join(installation, '..', '..'));
}

export function generateEnvPathForQtInstallation(installation: string) {
  const installationBinDir = path.join(installation, 'bin');
  const QtPathAddition = [installation, installationBinDir, '${env:PATH}'].join(
    path.delimiter
  );
  return QtPathAddition;
}

async function queryHostBinDirPath(selectedQtPath: string): Promise<string> {
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

export async function getQtDesignerPath(folder?: vscode.WorkspaceFolder) {
  const selectedQtPath = await getSelectedQtInstallationPath(folder);
  if (selectedQtPath) {
    return locateQtDesignerExePath(selectedQtPath);
  }
  return '';
}

export async function locateQtDesignerExePath(selectedQtPath: string) {
  const getDesignerExePath = (selectedQtBinPath: string) => {
    const macOSPath = path.join(
      'Designer.app',
      'Contents',
      'MacOS',
      DesignerExeName
    );
    return IsMacOS
      ? path.join(selectedQtBinPath, macOSPath)
      : path.join(selectedQtBinPath, DesignerExeName);
  };
  let designerExePath = getDesignerExePath(path.join(selectedQtPath, 'bin'));
  if (await fsutil.exists(designerExePath)) {
    return designerExePath;
  }

  const hostBinDir = await queryHostBinDirPath(selectedQtPath);
  designerExePath = getDesignerExePath(hostBinDir);
  if (await fsutil.exists(designerExePath)) {
    return designerExePath;
  }

  if (!IsWindows) {
    designerExePath = '/usr/bin/designer';
    if (await fsutil.exists(designerExePath)) {
      return designerExePath;
    }
  }

  return '';
}

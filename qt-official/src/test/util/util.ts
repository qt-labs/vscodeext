// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { matchesVersionPattern } from 'qt-lib';
import { mangleQtInstallation } from '../../util/util';

export function getFirstQtKit(qt_path: string | undefined) {
  if (typeof qt_path === 'undefined') {
    throw new Error('qt_path is undefined');
  }
  const installations = findQtInstallationsSync(qt_path);
  const kits = installations.map((installation) =>
    mangleQtInstallation(installation)
  );
  const MajorQtVersion = '6.';
  const os = process.platform;
  let osKit = '';
  if (os === 'linux') {
    osKit = 'gcc';
  } else if (os === 'win32') {
    osKit = 'msvc';
  } else if (os === 'darwin') {
    osKit = 'macos';
  }
  for (const kit of kits) {
    if (kit.includes(osKit) && kit.includes(MajorQtVersion)) {
      return kit;
    }
  }
  return undefined;
}

export function getFirstQtInstallation(qt_path: string | undefined) {
  if (typeof qt_path === 'undefined') {
    throw new Error('qt_path is undefined');
  }
  const installations = findQtInstallationsSync(qt_path);
  const MajorQtVersion = '6.';
  const os = process.platform;
  let osKit = '';
  if (os === 'linux') {
    osKit = 'gcc';
  } else if (os === 'win32') {
    osKit = 'msvc';
  } else if (os === 'darwin') {
    osKit = 'macos';
  }
  for (const installation of installations) {
    if (installation.includes(osKit) && installation.includes(MajorQtVersion)) {
      return installation;
    }
  }
  return undefined;
}

export async function activateIntegrationTestExtensions() {
  const extensions = ['theqtcompany.qt-official', 'ms-vscode.cmake-tools'];
  // if extensions are not activated, activate them explicitly
  for (const extension of extensions) {
    if (!vscode.extensions.getExtension(extension)?.isActive) {
      await vscode.extensions.getExtension(extension)?.activate();
    }
  }
}

export function findQtInstallationsSync(dir: string): string[] {
  const qtInstallations: string[] = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    if (item.isDirectory() && matchesVersionPattern(item.name)) {
      const installationItemPath = path.join(dir, item.name);
      const installationItemDirContent = fs.readdirSync(installationItemPath, {
        withFileTypes: true
      });
      for (const subitem of installationItemDirContent) {
        if (subitem.isDirectory() && subitem.name.toLowerCase() != 'src') {
          const subdirFullPath = path.join(installationItemPath, subitem.name);
          const qtConfPath = path.join(subdirFullPath, 'bin', 'qt.conf');
          try {
            fs.accessSync(qtConfPath);
            qtInstallations.push(subdirFullPath);
          } catch (err) {
            console.log(err);
          }
        }
      }
    }
  }
  return qtInstallations;
}

export function checkFolderExists(folder: string) {
  return fs.existsSync(folder);
}
export function checkFileExists(file: string) {
  return fs.existsSync(file);
}

export function getExtensionSourceRoot() {
  return path.normalize(path.join(__dirname, '../../..'));
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

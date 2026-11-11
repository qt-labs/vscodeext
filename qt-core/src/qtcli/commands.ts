// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';

import { exists, host, coreSettings } from 'qt-lib';
import {
  qtcliExeName,
  findActiveTabUri,
  fallbackWorkingDir
} from '@/qtcli/common';

export async function findQtcliExePath(extensionUri: vscode.Uri) {
  const prefix = findQtcliOsPrefix();
  const distDir = path.join(extensionUri.fsPath, 'res', 'qtcli');

  return findQtcliInDist(distDir, prefix);
}

export function getNewFileBaseDir() {
  const activeFileUri = findActiveTabUri();
  if (activeFileUri) {
    return path.dirname(activeFileUri.fsPath);
  }

  const anyFolder = vscode.workspace.workspaceFolders?.[0];
  return anyFolder ? anyFolder.uri.fsPath : fallbackWorkingDir();
}

export function getNewProjectBaseDir(): string {
  const value = coreSettings.defaultProjectDir.inspect()?.globalValue;
  return value ?? fallbackWorkingDir();
}

export async function setDefaultProjectDir(dir: string) {
  await coreSettings.defaultProjectDir.updateGlobal(path.normalize(dir));
}

function findQtcliOsPrefix(): string {
  if (host.isWindows) {
    return `qtcli-windows-${host.isArm64 ? 'arm64-' : 'amd64-'}`;
  } else if (host.isLinux) {
    return `qtcli-linux-${host.isArm64 ? 'arm64-' : 'amd64-'}`;
  } else if (host.isMacOS) {
    return 'qtcli-darwin-all-';
  } else {
    throw new Error(`Platform '${process.platform}' is not supported`);
  }
}

async function findQtcliInDist(distDir: string, prefix: string) {
  try {
    const entries = await fs.readdir(distDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith(prefix)) {
        const fullPath = path.join(distDir, entry.name, qtcliExeName);
        if (await exists(fullPath)) {
          return fullPath;
        }
      }
    }
  } catch {
    // do nothing
  }

  return undefined;
}

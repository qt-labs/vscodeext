// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';

import { exists, IsArm64, IsLinux, IsMacOS, IsWindows } from 'qt-lib';
import { EXTENSION_ID } from '@/constants';
import {
  qtcliExeName,
  findActiveTabUri,
  fallbackWorkingDir
} from '@/qtcli/common';

const ConfigDefaultProjectDirectory = 'defaultProjectDirectory';

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
  return getDefaultProjectDir() ?? fallbackWorkingDir();
}

export async function setDefaultProjectDir(dir: string) {
  const scope = vscode.ConfigurationTarget.Global;
  const config = vscode.workspace.getConfiguration(EXTENSION_ID);
  await config.update(
    ConfigDefaultProjectDirectory,
    path.normalize(dir),
    scope
  );
}

function getDefaultProjectDir(): string | undefined {
  const config = vscode.workspace.getConfiguration(EXTENSION_ID);
  const readback = config.inspect<string>(ConfigDefaultProjectDirectory);
  return readback?.globalValue;
}

function findQtcliOsPrefix(): string {
  if (IsWindows) {
    return `qtcli-windows-${IsArm64 ? 'arm64-' : 'amd64-'}`;
  } else if (IsLinux) {
    return `qtcli-linux-${IsArm64 ? 'arm64-' : 'amd64-'}`;
  } else if (IsMacOS) {
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

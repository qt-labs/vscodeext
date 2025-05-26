// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import * as vscode from 'vscode';

import { EXTENSION_ID } from '@/constants';
import { QtcliExeFinder } from '@/qtcli/exe-finder';
import { findActiveTabUri, fallbackWorkingDir } from '@/qtcli/common';

const ConfigDefaultProjectDirectory = 'defaultProjectDirectory';

export async function findQtcliExePath(extensionUri: vscode.Uri) {
  const finder = new QtcliExeFinder();
  finder.addPossibleDir(process.cwd());
  finder.addPossibleDir((process.env.PATH ?? '').split(path.delimiter));
  finder.addDistDir(path.join(extensionUri.fsPath, 'res', 'qtcli'));

  return finder.run();
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

export function getDefaultProjectDir(): string | undefined {
  const config = vscode.workspace.getConfiguration(EXTENSION_ID);
  const readback = config.inspect<string>(ConfigDefaultProjectDirectory);
  return readback?.globalValue;
}

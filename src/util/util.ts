// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Returns true if the extension is currently running tests.
 */
export function isTestMode(): boolean {
  return process.env.QT_TESTING === '1';
}

export function mangleQtInstallation(installation: string): string {
  const pathParts = installation.split(/[/\\:]+/).filter((n) => n);
  const qtIdx = Math.max(
    0,
    pathParts.findIndex((s) => s.toLowerCase() == 'qt')
  );
  return pathParts.slice(qtIdx).join('-');
}

export function getFilenameWithoutExtension(filename: string): string {
  const separatedPath = filename.split(path.sep).pop();
  if (!separatedPath) {
    throw new Error('Filename is empty');
  }
  return separatedPath.split('.')[0];
}

export function isError<T>(e: T): e is T & Error {
  return e instanceof Error;
}

export function isMultiWorkspace(): boolean {
  return vscode.workspace.workspaceFile !== undefined;
}

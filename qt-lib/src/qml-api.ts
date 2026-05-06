// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

/**
 * The interface provided by the qt-qml extension during activation.
 * Allows other VS Code extensions to interact with qt-qml extension.
 */
export interface QmlTraceFileAPI {
  open(uri: vscode.Uri): void;
  close(uri: vscode.Uri): void;
  getAdditionalDirs(uri: vscode.Uri): string[];
  setAdditionalDirs(uri: vscode.Uri, dirs: string[]): void;
}

export interface QtQmlAPI {
  traceFile: QmlTraceFileAPI;
}

/**
 * Get the API from the qt-qml extension.
 * Activates the extension if it is not already active.
 * @returns The QtQmlAPI or undefined if the extension is not installed.
 */
export async function getQtQmlApi(): Promise<QtQmlAPI | undefined> {
  const ext = vscode.extensions.getExtension('theqtcompany.qt-qml');
  if (!ext) {
    return undefined;
  }

  if (ext.isActive) {
    return ext.exports as QtQmlAPI;
  }

  try {
    return (await ext.activate()) as QtQmlAPI;
  } catch {
    return undefined;
  }
}

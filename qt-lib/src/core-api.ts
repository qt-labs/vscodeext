// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

export class QtWorkspaceConfigMessage {
  workspaceFolder: vscode.WorkspaceFolder | string;
  config: QtWorkspaceConfig;
  constructor(folder?: vscode.WorkspaceFolder | string) {
    this.workspaceFolder = folder ?? 'global';
    this.config = new Map<string, string | QtWorkspaceType | undefined>();
  }
}

export type QtWorkspaceConfig = Map<
  string,
  string | QtWorkspaceType | undefined
>;

export enum QtWorkspaceType {
  CMakeExt = 'CMakeExt',
  CMakeCMD = 'CMakeCMD',
  PythonExt = 'PythonExt'
}

export interface CoreApi {
  update(config: QtWorkspaceConfigMessage): void;
  getValue<T>(
    folder: vscode.WorkspaceFolder | string,
    key: string
  ): T | undefined;
  onValueChanged: vscode.Event<QtWorkspaceConfigMessage>;
}

export async function getCoreApi(): Promise<CoreApi | undefined> {
  const extension = vscode.extensions.getExtension('theqtcompany.qt-core');
  if (!extension) {
    console.error('[theqtcompany.qt-core] is not installed');
    return undefined;
  }
  let exports: CoreApi | undefined;
  if (!extension.isActive) {
    try {
      exports = (await extension.activate()) as CoreApi;
    } catch (e) {
      console.error('Failed to activate [theqtcompany.qt-core]', e);
      return undefined;
    }
  } else {
    exports = extension.exports as CoreApi;
  }
  return exports;
}

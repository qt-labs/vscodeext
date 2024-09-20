// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import { CORE_EXTENSION_ID } from './constants';

export type QtWorkspaceConfig = Map<
  string,
  string | string[] | QtWorkspaceType | undefined
>;

export class QtWorkspaceConfigMessage {
  workspaceFolder: vscode.WorkspaceFolder | string;
  config: QtWorkspaceConfig;
  constructor(folder?: vscode.WorkspaceFolder | string) {
    this.workspaceFolder = folder ?? 'global';
    this.config = new Map() as QtWorkspaceConfig;
  }
  get<T>(key: string, defaultValue?: T): T | undefined {
    const value = this.config.get(key);
    if (value === undefined) {
      return defaultValue;
    }
    return value as T;
  }
}

export enum QtWorkspaceType {
  CMakeExt = 'CMakeExt',
  CMakeCMD = 'CMakeCMD',
  PythonExt = 'PythonExt'
}

export type QtPathsData = Map<string, string>;

export class QtInfo {
  qtpathsExecutable: string;
  qtpathsData: QtPathsData;

  constructor(filePath: string) {
    this.qtpathsExecutable = filePath;
    this.qtpathsData = new Map() as QtPathsData;
  }
  public get(key: string): string | undefined {
    return this.qtpathsData.get(key);
  }
  public set(key: string, value: string): void {
    this.qtpathsData.set(key, value);
  }
}

export interface CoreAPI {
  update(config: QtWorkspaceConfigMessage): void;
  getValue<T>(
    folder: vscode.WorkspaceFolder | string,
    key: string
  ): T | undefined;
  onValueChanged: vscode.Event<QtWorkspaceConfigMessage>;
  getQtInfo(qtPathsExecutable: string): QtInfo | undefined;
}

export async function getCoreApi(): Promise<CoreAPI | undefined> {
  const extension = vscode.extensions.getExtension(
    `theqtcompany.${CORE_EXTENSION_ID}`
  );
  if (!extension) {
    console.error(`[theqtcompany.${CORE_EXTENSION_ID}] is not installed`);
    return undefined;
  }
  let exports: CoreAPI | undefined;
  if (!extension.isActive) {
    try {
      exports = (await extension.activate()) as CoreAPI;
    } catch (e) {
      console.error(
        `Failed to activate [theqtcompany.${CORE_EXTENSION_ID}]`,
        e
      );
      return undefined;
    }
  } else {
    exports = extension.exports as CoreAPI;
  }
  return exports;
}

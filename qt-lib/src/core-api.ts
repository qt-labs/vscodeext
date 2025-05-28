// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import { CORE_EXTENSION_ID } from './constants';

export interface QtAdditionalPath {
  name?: string | undefined;
  path: string;
  isVCPKG?: boolean;
}

// Implement sorter for QtAdditionalPath
export function compareQtAdditionalPath(
  a: QtAdditionalPath,
  b: QtAdditionalPath
): number {
  if (a.name === undefined && b.name === undefined) {
    return a.path.localeCompare(b.path);
  }
  if (a.name === undefined) {
    return -1;
  }
  if (b.name === undefined) {
    return 1;
  }
  return a.name.localeCompare(b.name);
}

export type ConfigType =
  | string
  | QtAdditionalPath[]
  | QtWorkspaceType
  | undefined;

export type QtWorkspaceConfig = Map<string, ConfigType>;

type MessageConfigs = Set<string>;
export class QtWorkspaceConfigMessage {
  workspaceFolder: vscode.WorkspaceFolder | string;
  config: MessageConfigs;
  constructor(folder?: vscode.WorkspaceFolder | string) {
    this.workspaceFolder = folder ?? 'global';
    this.config = new Set() as MessageConfigs;
  }
  toString(): string {
    const configs = Array.from(this.config).join(', ');
    let folder: vscode.WorkspaceFolder | string;
    if (typeof this.workspaceFolder === 'string') {
      folder = this.workspaceFolder;
    } else {
      folder = this.workspaceFolder.name;
    }
    return `[${folder}]: ${configs}`;
  }
}

export enum QtWorkspaceType {
  CMakeExt = 'CMakeExt',
  CMakeCMD = 'CMakeCMD',
  PythonExt = 'PythonExt'
}

export type QtPathsData = Map<string, string>;

export class QtInfo {
  data: QtPathsData;

  constructor(
    public readonly qtPathsBin: string,
    public name?: string,
    public isVCPKG?: boolean
  ) {
    this.data = new Map() as QtPathsData;
  }
  public get(key: string): string | undefined {
    return this.data.get(key);
  }
  public set(key: string, value: string): void {
    this.data.set(key, value);
  }
}

export interface CoreAPI {
  notify(config: QtWorkspaceConfigMessage): void;
  getValue<T>(
    folder: vscode.WorkspaceFolder | string,
    key: string
  ): T | undefined;
  setValue(
    folder: vscode.WorkspaceFolder | string,
    key: string,
    value: ConfigType
  ): void;
  onValueChanged: vscode.Event<QtWorkspaceConfigMessage>;
  getQtInfo(qtPathsExecutable: QtAdditionalPath): QtInfo | undefined;
  getQtInfoFromPath(qtPathsExe: string): QtInfo | undefined;
  reset(): void;
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

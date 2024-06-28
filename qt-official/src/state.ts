// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { isTestMode } from '@util/util';
import { Kit } from '@/kit-manager';
import { createLogger } from 'qt-lib';

const logger = createLogger('state');

class BaseStateManager {
  constructor(
    readonly context: vscode.ExtensionContext,
    readonly folder?: vscode.WorkspaceFolder
  ) {}
  protected _get<T>(key: string, defaultValue: T): T {
    const state = isTestMode()
      ? this.context.workspaceState
      : this.context.globalState;
    const ret = state.get<T>(this.folder?.uri.fsPath + key);
    if (ret === undefined) {
      return defaultValue;
    }
    return ret;
  }
  protected _update<T>(key: string, value: T): Thenable<void> {
    const state = isTestMode()
      ? this.context.workspaceState
      : this.context.globalState;
    return state.update(this.folder?.uri.fsPath + key, value);
  }
}

export class WorkspaceStateManager extends BaseStateManager {
  constructor(
    context: vscode.ExtensionContext,
    folder: vscode.WorkspaceFolder
  ) {
    if (folder.uri.fsPath === '') {
      logger.error('folder is empty');
      throw new Error('folder is empty');
    }
    super(context, folder);
  }
  public getQtFolder(): string {
    return this._get<string>('qtFolder', '');
  }
  public setQtFolder(folder: string): Thenable<void> {
    return this._update('qtFolder', folder);
  }
  public getWorkspaceQtKits(): Kit[] {
    return this._get<Kit[]>('defaultQtKits', []);
  }
  public setWorkspaceQtKits(kits: Kit[]): Thenable<void> {
    return this._update('defaultQtKits', kits);
  }
  public async reset() {
    await this.setWorkspaceQtKits([]);
    await this.setQtFolder('');
  }
}

export class GlobalStateManager extends BaseStateManager {
  public getQtFolder(): string {
    return this._get<string>('qtFolder', '');
  }
  public setQtFolder(folder: string): Thenable<void> {
    return this._update('qtFolder', folder);
  }
  public getGlobalQtKits(): Kit[] {
    return this._get<Kit[]>('globalQtKits', []);
  }
  public setGlobalQtKits(kits: Kit[]): Thenable<void> {
    return this._update('globalQtKits', kits);
  }

  public async reset() {
    await this.setGlobalQtKits([]);
    await this.setQtFolder('');
  }
}

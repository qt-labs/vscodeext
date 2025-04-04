// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { createLogger, BaseStateManager } from 'qt-lib';
import { Kit } from '@/kit-manager';

const logger = createLogger('state');

type QtModules = Record<string, string[]>;

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
  public getWorkspaceQtKits(): Kit[] {
    return this._get<Kit[]>('defaultQtKits', []);
  }
  public getWorkspaceQtPathsQtKits(): Kit[] {
    return this._get<Kit[]>('QtPathsQtKits', []);
  }
  public getModules(): Map<string, string[]> {
    const obj = this._get<QtModules>('QtModules', {});
    return new Map<string, string[]>(Object.entries(obj));
  }
  public setModules(modules: Map<string, string[]>): Thenable<void> {
    const obj: QtModules = {};
    modules.forEach((value, key) => {
      obj[key] = value;
    });
    return this._update('QtModules', obj);
  }
  public setWorkspaceQtPathsQtKits(kits: Kit[]): Thenable<void> {
    return this._update('QtPathsQtKits', kits);
  }

  public setWorkspaceQtKits(kits: Kit[]): Thenable<void> {
    return this._update('defaultQtKits', kits);
  }
  public async reset() {
    await this.setWorkspaceQtPathsQtKits([]);
    await this.setWorkspaceQtKits([]);
  }
}

export class GlobalStateManager extends BaseStateManager {
  public getGlobalQtKits(): Kit[] {
    return this._get<Kit[]>('globalQtKits', []);
  }
  public setGlobalQtKits(kits: Kit[]): Thenable<void> {
    return this._update('globalQtKits', kits);
  }
  public getGlobalQtPathsQtKits(): Kit[] {
    return this._get<Kit[]>('globalQtPathsQtKits', []);
  }
  public setGlobalQtPathsQtKits(kits: Kit[]): Thenable<void> {
    return this._update('globalQtPathsQtKits', kits);
  }

  public async reset() {
    await this.setGlobalQtPathsQtKits([]);
    await this.setGlobalQtKits([]);
  }
}

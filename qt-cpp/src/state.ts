// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { createLogger, BaseStateManager } from 'qt-lib';
import { Kit } from '@/kit-manager';

const logger = createLogger('state');

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
  public setWorkspaceQtKits(kits: Kit[]): Thenable<void> {
    return this._update('defaultQtKits', kits);
  }
  public async reset() {
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

  public async reset() {
    await this.setGlobalQtKits([]);
  }
}

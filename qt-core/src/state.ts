// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import {
  createLogger,
  QtInsRootConfigName,
  BaseStateManager,
  AdditionalQtPathsName,
  QtAdditionalPath
} from 'qt-lib';

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
  public getQtInstallationRoot(): string {
    return this._get<string>(QtInsRootConfigName, '');
  }
  public setQtInstallationRoot(folder: string): Thenable<void> {
    return this._update(QtInsRootConfigName, folder);
  }
  public getAdditionalQtPaths(): QtAdditionalPath[] {
    return this._get<QtAdditionalPath[]>(AdditionalQtPathsName, []);
  }
  public setAdditionalQtPaths(paths: QtAdditionalPath[]): Thenable<void> {
    return this._update(AdditionalQtPathsName, paths);
  }
  public async reset() {
    await this.setQtInstallationRoot('');
    await this.setAdditionalQtPaths([]);
  }
}

export class GlobalStateManager extends BaseStateManager {
  public getQtInstallationRoot(): string {
    return this._get<string>(QtInsRootConfigName, '');
  }
  public setQtInstallationRoot(folder: string): Thenable<void> {
    return this._update(QtInsRootConfigName, folder);
  }
  public getAdditionalQtPaths(): QtAdditionalPath[] {
    return this._get<QtAdditionalPath[]>(AdditionalQtPathsName, []);
  }
  public setAdditionalQtPaths(paths: QtAdditionalPath[]): Thenable<void> {
    return this._update(AdditionalQtPathsName, paths);
  }

  public async reset() {
    await this.setQtInstallationRoot('');
    await this.setAdditionalQtPaths([]);
  }
}

// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import {
  createLogger,
  QtInsRootConfigName,
  BaseStateManager,
  AdditionalQtPathsName,
  QtAdditionalPath,
  CoreKey
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
  constructor(context: vscode.ExtensionContext) {
    super(context, CoreKey.GLOBAL_WORKSPACE);
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

  public getNewProjectOpenIn(): 'addToWorkspace' | 'newWindow' {
    return this._get<'addToWorkspace' | 'newWindow'>(
      'newProjectOpenIn',
      'newWindow'
    );
  }
  public setNewProjectOpenIn(
    value: 'addToWorkspace' | 'newWindow'
  ): Thenable<void> {
    return this._update('newProjectOpenIn', value);
  }

  public async reset() {
    await this.setQtInstallationRoot('');
    await this.setAdditionalQtPaths([]);
  }
}

// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import {
  QtInsRootConfigName,
  BaseWorkspaceStateManager,
  BaseGlobalStateManager,
  AdditionalQtPathsName,
  QtAdditionalPath
} from 'qt-lib';

export class WorkspaceStateManager extends BaseWorkspaceStateManager {
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

export class GlobalStateManager extends BaseGlobalStateManager {
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

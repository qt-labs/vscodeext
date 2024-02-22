// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import { isTestMode } from './util/util';

export class StateManager {
  constructor(readonly context: vscode.ExtensionContext) {
    this.context = context;
  }
  private _get<T>(key: string, defaultValue: T): T {
    const state = isTestMode()
      ? this.context.workspaceState
      : this.context.globalState;
    const ret = state.get<T>(key);
    if (ret === undefined) {
      return defaultValue;
    }
    return ret;
  }
  private _update<T>(key: string, value: T): Thenable<void> {
    const state = isTestMode()
      ? this.context.workspaceState
      : this.context.globalState;
    return state.update(key, value);
  }
  public getQtInstallations(): string[] {
    return this._get<string[]>('qtInstallations', []);
  }
  public setQtInstallations(value: string[]): Thenable<void> {
    return this._update('qtInstallations', value);
  }
  public setAskForDefaultQtFolder(value: boolean): Thenable<void> {
    return this._update('askForDefaultQtFolder', value);
  }
  public getAskForDefaultQtFolder(): boolean {
    return this._get<boolean>('askForDefaultQtFolder', true);
  }
  public async reset() {
    await this.setQtInstallations([]);
    await this.setAskForDefaultQtFolder(true);
  }
}

export function initStateManager(context: vscode.ExtensionContext) {
  stateManager = new StateManager(context);
}

export let stateManager: StateManager;

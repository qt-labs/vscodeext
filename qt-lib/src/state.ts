// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { CoreKey } from './constants';

export class BaseStateManager {
  constructor(
    readonly context: vscode.ExtensionContext,
    readonly folder: vscode.WorkspaceFolder | typeof CoreKey.GLOBAL_WORKSPACE
  ) {}
  protected _get<T>(key: string, defaultValue: T): T {
    const state = this.context.globalState;
    const prefix =
      typeof this.folder === 'string' ? this.folder : this.folder.uri.fsPath;
    const ret = state.get<T>(prefix + key);
    if (ret === undefined) {
      return defaultValue;
    }
    return ret;
  }
  protected _update<T>(key: string, value: T): Thenable<void> {
    const state = this.context.globalState;
    const prefix =
      typeof this.folder === 'string' ? this.folder : this.folder.uri.fsPath;
    return state.update(prefix + key, value);
  }
}

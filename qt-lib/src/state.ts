// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

export class BaseStateManager {
  constructor(
    readonly context: vscode.ExtensionContext,
    readonly folder?: vscode.WorkspaceFolder
  ) {}
  protected _get<T>(key: string, defaultValue: T): T {
    const state = this.context.globalState;
    const ret = state.get<T>(this.folder?.uri.fsPath + key);
    if (ret === undefined) {
      return defaultValue;
    }
    return ret;
  }
  protected _update<T>(key: string, value: T): Thenable<void> {
    const state = this.context.globalState;
    return state.update(this.folder?.uri.fsPath + key, value);
  }
}

// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

export class QmlTraceDoc implements vscode.CustomDocument {
  private readonly _uri: vscode.Uri;
  private readonly _context: vscode.ExtensionContext;

  constructor(uri: vscode.Uri, context: vscode.ExtensionContext) {
    this._uri = uri;
    this._context = context;
  }

  // eslint-disable-next-line
  public dispose() {}

  get uri() {
    return this._uri;
  }

  get additionalDirs() {
    return this._context.globalState.get<string[]>(this._stateKey()) ?? [];
  }

  public setAdditionalDirs(dirs: string[]): Thenable<void> {
    const value = dirs.map((d) => d.trim()).filter((d) => d.length > 0);
    // TODO: check if having a valid dir pattern

    return this._context.globalState.update(this._stateKey(), value);
  }

  private _stateKey() {
    return `qmlTrace.additionalDirs:${this._uri.fsPath}`;
  }
}

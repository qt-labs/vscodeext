// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

export class DisposableStore implements vscode.Disposable {
  private readonly _disposables: vscode.Disposable[] = [];

  public push<T extends vscode.Disposable>(disposable: T): T;
  public push(...disposables: vscode.Disposable[]): void;
  public push(...disposables: vscode.Disposable[]): vscode.Disposable | void {
    this._disposables.push(...disposables);

    if (disposables.length === 1) {
      return disposables[0];
    }
  }

  public dispose() {
    try {
      this._disposables.forEach((d) => {
        d.dispose();
      });
    } finally {
      this._disposables.length = 0;
    }
  }
}

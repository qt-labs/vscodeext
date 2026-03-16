// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import { coreAPI } from '@/extension';

import { CoreKey, QtWorkspaceConfigMessage } from 'qt-lib';
import { ExBrowserController } from './controller';

export class ExCoreWatcher {
  private readonly _disposables: vscode.Disposable[] = [];

  public constructor(
    private readonly _panel: vscode.WebviewPanel,
    private readonly _context: vscode.ExtensionContext
  ) {
    if (coreAPI) {
      this._disposables.push(coreAPI.onValueChanged(this._onValueChanged));
    }
  }

  public dispose() {
    this._disposables.forEach((d) => void d.dispose());
    this._disposables.length = 0;
  }

  private readonly _onValueChanged = (msg: QtWorkspaceConfigMessage) => {
    if (
      !msg.config.has(CoreKey.ADDITIONAL_QT_PATHS) &&
      !msg.config.has(CoreKey.QT_INSTALLATION_ROOT)
    ) {
      return;
    }

    this._panel.dispose();
    ExBrowserController.render(this._context);
  };
}

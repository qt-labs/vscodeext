// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { WebviewDispatcher } from '@/webview/dispatcher';
import { Command, CommandId } from '@/webview/shared/message';
import { findUiDesignerSession } from '@/ui-designer/session';

export class UiFileEditorController extends WebviewDispatcher {
  public constructor(
    panel: vscode.WebviewPanel,
    private readonly _docUri: vscode.Uri
  ) {
    super('ui-designer', panel);
    this.setHandlers([
      [CommandId.UiFileOpenInDesigner, this._onOpenInDesigner],
      [CommandId.UiFileOpenInTextEditor, this._onOpenFileInTextEditor]
    ]);
  }

  private readonly _onOpenInDesigner = (cmd: Command) => {
    const session = findUiDesignerSession(this._docUri);
    if (session) {
      void session.open(this._docUri);
    }

    this.channel.replyDone(cmd);
  };

  private readonly _onOpenFileInTextEditor = (cmd: Command) => {
    void vscode.window.showTextDocument(this._docUri);
    this.channel.replyDone(cmd);
  };
}

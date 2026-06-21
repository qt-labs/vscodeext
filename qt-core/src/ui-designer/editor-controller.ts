// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { createWrappedLogger } from 'qt-lib';
import {
  Command,
  CommandId,
  CommandHandler,
  IsCommand
} from '@/webview/shared/message';
import { WebviewChannel } from '@/webview/channel';
import { findUiDesignerSession } from '@/ui-designer/session';

const logger = createWrappedLogger('ui-designer-controller');

export class UiFileEditorController {
  private readonly _comm: WebviewChannel;
  private readonly _routes: Map<CommandId, CommandHandler>;
  private readonly _disposables: vscode.Disposable[] = [];

  public constructor(
    private readonly _panel: vscode.WebviewPanel,
    private readonly _docUri: vscode.Uri
  ) {
    this._comm = new WebviewChannel(this._panel.webview);
    this._disposables.push(
      this._comm,
      this._comm.onDidReceiveMessage(this._dispatch)
    );

    this._routes = new Map<CommandId, CommandHandler>([
      [CommandId.UiFileOpenInDesigner, this._onOpenInDesigner],
      [CommandId.UiFileOpenInTextEditor, this._onOpenFileInTextEditor]
    ]);
  }

  public dispose() {
    this._disposables.forEach((d) => {
      d.dispose();
    });
    this._disposables.length = 0;
  }

  private readonly _dispatch = async (cmd: unknown) => {
    if (!IsCommand(cmd)) {
      return;
    }

    const handler = this._routes.get(cmd.id);
    if (!handler) {
      logger.text('Unhandled command').data('id', String(cmd.id)).warn();
      return;
    }

    try {
      await handler(cmd);
    } catch (e) {
      logger
        .text('Error while handling command')
        .data(String(cmd.id), String(e))
        .error();
    }
  };

  private readonly _onOpenInDesigner = (cmd: Command) => {
    const session = findUiDesignerSession(this._docUri);
    if (session) {
      void session.open(this._docUri);
    }

    this._comm.postDataReply(cmd, { status: 'done' });
  };

  private readonly _onOpenFileInTextEditor = (cmd: Command) => {
    void vscode.window.showTextDocument(this._docUri);
    this._comm.postDataReply(cmd, { status: 'done' });
  };
}

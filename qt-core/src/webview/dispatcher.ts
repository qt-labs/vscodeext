// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { createWrappedLogger, DisposableStore } from 'qt-lib';
import { WebviewChannel } from '@/webview/channel';
import { type AppId } from './shared/types';
import { isCommand, CommandId, CommandHandler } from '@/webview/shared/message';

interface DispatcherContext {
  id: AppId;
  panel: vscode.WebviewPanel;
}

export class WebviewDispatcher implements vscode.Disposable {
  private readonly _context: DispatcherContext;
  private readonly _channel: WebviewChannel;
  private readonly _logger: ReturnType<typeof createWrappedLogger>;
  private readonly _handlers = new Map<CommandId, CommandHandler>();
  private readonly _disposables = new DisposableStore();

  public constructor(id: AppId, panel: vscode.WebviewPanel) {
    this._context = {
      id,
      panel
    };

    this._channel = new WebviewChannel(panel.webview);
    this._logger = createWrappedLogger(`${id}-dispatcher`);

    this._disposables.push(
      this._channel.onDidReceiveMessage((m) => {
        void this._dispatch(m);
      })
    );
  }

  public dispose() {
    this._disposables.dispose();
  }

  public get context() {
    return this._context;
  }

  public get channel() {
    return this._channel;
  }

  public setHandlers(all: [CommandId, CommandHandler][]) {
    all.forEach(([id, handler]) => {
      this._handlers.set(id, handler);
    });
  }

  private async _dispatch(cmd: unknown) {
    if (!isCommand(cmd)) {
      return;
    }

    const handler = this._handlers.get(cmd.id);
    if (!handler) {
      this._logger
        .text('Cannot find command handler')
        .data('id', cmd.id)
        .data('name', CommandId[cmd.id])
        .warn();
      return;
    }

    try {
      await handler(cmd);
    } catch (e) {
      this._logger
        .text('Cannot handle command')
        .data('id', cmd.id)
        .data('name', CommandId[cmd.id])
        .data('error', String(e))
        .error();
    }
  }
}

// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { createWrappedLogger } from 'qt-lib';
import { WebviewChannel } from '@/webview/channel';
import { isCommand, CommandId, CommandHandler } from '@/webview/shared/message';

interface DispatcherContext {
  name: string;
  panel: vscode.WebviewPanel;
  logger: ReturnType<typeof createWrappedLogger>;
}

export class WebviewDispatcher {
  private readonly _context: DispatcherContext;
  private readonly _channel: WebviewChannel;
  private readonly _handlers = new Map<CommandId, CommandHandler>();
  private readonly _disposables: vscode.Disposable[] = [];

  public constructor(name: string, panel: vscode.WebviewPanel) {
    this._context = {
      name,
      panel,
      logger: createWrappedLogger(`${name}-dispatcher`)
    };

    this._channel = new WebviewChannel(panel.webview);
    this._disposables = [
      this._channel,
      this._channel.onDidReceiveMessage((m) => {
        void this._dispatch(m);
      })
    ];
  }

  public dispose() {
    this._disposables.forEach((d) => void d.dispose());
    this._disposables.length = 0;
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
      this._context.logger
        .text('unhandled command')
        .data('id', CommandId[cmd.id])
        .warn();
      return;
    }

    try {
      await handler(cmd);
    } catch (e) {
      this._context.logger
        .text('Cannot handle command')
        .data('id', CommandId[cmd.id])
        .data('error', String(e))
        .error();
    }
  }
}

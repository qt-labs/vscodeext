// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import {
  Command,
  CommandId,
  ErrorResponse,
  Issue
} from '@/webview/shared/message';

export class WebviewChannel {
  private readonly _view: vscode.Webview;
  private readonly _disposables: vscode.Disposable[] = [];
  private readonly _onDidReceiveMessage = new vscode.EventEmitter<unknown>();

  public constructor(view: vscode.Webview) {
    this._view = view;
    this._disposables.push(
      this._view.onDidReceiveMessage((m: unknown) => {
        this._onDidReceiveMessage.fire(m);
      })
    );
  }

  public dispose() {
    this._disposables.forEach((d) => {
      d.dispose();
    });
    this._disposables.length = 0;
  }

  public get onDidReceiveMessage() {
    return this._onDidReceiveMessage.event;
  }

  public post(
    id: CommandId,
    payload: unknown,
    tag: string | undefined = undefined
  ) {
    void this._view.postMessage({ id, payload, tag });
  }

  public postDataReply(cmd: Command, data: unknown) {
    this.post(cmd.id, { data }, cmd.tag);
  }

  public postErrorReply(cmd: Command, error: unknown) {
    this.post(cmd.id, { error }, cmd.tag);
  }

  public postErrorReplyFrom(cmd: Command, msg: string, details: Issue[]) {
    const e: ErrorResponse = {
      error: msg,
      details
    };

    this.postErrorReply(cmd, e);
  }
}

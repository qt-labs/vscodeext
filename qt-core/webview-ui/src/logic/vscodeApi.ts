// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import type { WebviewApi } from 'vscode-webview';

import {
  type PushMessage,
  PushMessageId,
  isPushMessage
} from '@shared/message';

class VSCodeApiWrapper {
  private readonly _api: WebviewApi<unknown> | undefined;
  private _onDidReceivePushMessage = (p: PushMessage) => {};

  constructor() {
    if (typeof acquireVsCodeApi === 'function') {
      this._api = acquireVsCodeApi();
    }

    window.addEventListener('message', (e: MessageEvent) => {
      if (e.origin.startsWith('vscode-webview://')) {
        const data = e.data;
        if (isPushMessage(data)) {
          this._onDidReceivePushMessage(data as PushMessage);
        }
      }
    });
  }

  public onDidReceivePushMessage(handler: (p: PushMessage) => void) {
    this._onDidReceivePushMessage = handler;
  }

  public isValid(): boolean {
    return this._api !== undefined;
  }

  public push(id: PushMessageId, data?: unknown) {
    if (!this._api) {
      console.warn('cannot push data, invalid vscode api instance');
      return;
    }

    const p: PushMessage = { id, data };
    this._api.postMessage(p);
  }
}

export const vscodeApi = new VSCodeApiWrapper();

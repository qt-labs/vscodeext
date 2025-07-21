// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import type { WebviewApi } from 'vscode-webview';

import {
  CommandId,
  type CommandReply,
  OneWayCommandIds
} from '@shared/message';

class VSCodeApiWrapper {
  private readonly _api: WebviewApi<unknown> | undefined;
  private _pendingCommands = new Map<string, (r: CommandReply) => void>();
  private _onDidReceiveNotification = (r: CommandReply) => {
    console.log('unhandled command reply', r);
  };

  constructor() {
    if (typeof acquireVsCodeApi === 'function') {
      this._api = acquireVsCodeApi();
    }

    window.addEventListener('message', (e: MessageEvent) => {
      if (e.origin.startsWith('vscode-webview://')) {
        this._onDidReceiveReply(e.data);
      }
    });
  }

  public onDidReceiveNotification(handler: (p: CommandReply) => void) {
    this._onDidReceiveNotification = handler;
  }

  public isValid(): boolean {
    return this._api !== undefined;
  }

  public async post<T = unknown>(
    id: CommandId,
    payload?: unknown,
    timeout = 10_000
  ): Promise<T> {
    if (!this._api) {
      return Promise.reject('VSCode API not available');
    }

    if (OneWayCommandIds.includes(id)) {
      this._api.postMessage({ id, payload });
      return undefined as T;
    }

    const tag = this._generateTag();

    return new Promise<T>((resolve, reject) => {
      this._pendingCommands.set(tag, (r: CommandReply) => {
        const p = r.payload;
        if (p.error !== undefined) {
          reject(p.error);
        } else {
          resolve(p.data as T);
        }
      });

      this._api!.postMessage({ id, tag, payload });

      if (timeout > 0) {
        setTimeout(() => {
          if (this._pendingCommands.has(tag)) {
            this._pendingCommands.delete(tag);
            reject(new Error(`Call request timed out: cmd = ${CommandId[id]}`));
          }
        }, timeout);
      }
    });
  }

  private _onDidReceiveReply(r: CommandReply) {
    if (OneWayCommandIds.includes(r.id)) {
      this._onDidReceiveNotification(r);
      return;
    }

    const resolve = this._pendingCommands.get(r.tag);
    if (!resolve) {
      return;
    }

    this._pendingCommands.delete(r.tag);
    resolve(r);
  }

  private _generateTag(): string {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 9);
    return `command_${timestamp}_${randomId}`;
  }
}

export const vscode = new VSCodeApiWrapper();

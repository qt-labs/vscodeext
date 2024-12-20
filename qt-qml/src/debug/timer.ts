// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

export class Timer {
  private readonly _onTimeout: vscode.EventEmitter<void> =
    new vscode.EventEmitter<void>();
  private _singleShot = false;
  private _interval: number | undefined; // ms
  private _timer: NodeJS.Timeout | undefined;
  constructor(interval?: number) {
    this._interval = interval;
  }
  get onTimeout() {
    return this._onTimeout.event;
  }
  dispose() {
    this.disconnect();
    this.stop();
  }
  disconnect() {
    this._onTimeout.dispose();
  }

  isActive() {
    return this._timer ? true : false;
  }

  start(interval?: number) {
    if (interval !== undefined) {
      this._interval = interval;
    }
    if (this._timer) {
      this.stop();
    }
    if (this._interval === undefined) {
      return;
    }
    this._timer = setInterval(() => {
      this._onTimeout.fire();
      if (this._singleShot) {
        this.stop();
      }
    }, this._interval);
  }

  setInterval(interval: number) {
    this._interval = interval;
  }

  setSingleShot(singleShot: boolean) {
    this._singleShot = singleShot;
  }

  stop() {
    clearInterval(this._timer);
    this._timer = undefined;
  }
  public static singleShot(interval: number, callback: () => void) {
    setTimeout(callback, interval);
  }
}

// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import { Logger, createLogger } from 'qt-lib';

export function createWrappedLogger(tag: string) {
  return new LoggerWrapper(createLogger(tag));
}

interface OutputOptions {
  showMessage: boolean;
  multipleLine: boolean;
}

const DefaultOutputOptions: OutputOptions = {
  showMessage: false,
  multipleLine: false
};

class LoggerWrapper {
  private _text = '';
  private readonly _data = new Map<string, string>();

  constructor(private readonly _logger: Logger) {}

  public text(text: string) {
    this._text = text;
    return this;
  }

  public data(name: string, value: string) {
    this._data.set(name, value);
    return this;
  }

  public toString() {
    return this._buildSingleLineOutput();
  }

  private clear() {
    this._text = '';
    this._data.clear();
  }

  public error(o: Partial<OutputOptions> = {}) {
    this._logAndClear('error', o);
  }

  public warn(o: Partial<OutputOptions> = {}) {
    this._logAndClear('warn', o);
  }

  public info(o: Partial<OutputOptions> = {}) {
    this._logAndClear('info', o);
  }

  public verbose(o: Partial<OutputOptions> = {}) {
    this._logAndClear('verbose', o);
  }

  public debug(o: Partial<OutputOptions> = {}) {
    this._logAndClear('debug', o);
  }

  // privates
  private _buildSingleLineOutput() {
    const pairs = [...this._data.entries()]
      .map(([key, value]) => `${key} = ${value}`)
      .join(', ');

    return pairs.length > 0 ? `${this._text}: ${pairs}` : this._text;
  }

  private _logAndClear(
    level: 'error' | 'warn' | 'info' | 'verbose' | 'debug',
    options: Partial<OutputOptions>
  ) {
    const out = this._logger[level].bind(this._logger);
    const o: OutputOptions = { ...DefaultOutputOptions, ...options };

    if (o.multipleLine) {
      out(this._text);

      this._data.forEach((value, key) => {
        out(`- ${key}: ${value}`);
      });
    } else {
      out(this._buildSingleLineOutput());
    }

    if (o.showMessage) {
      const text = this._buildSingleLineOutput();

      if (level === 'error') {
        void vscode.window.showErrorMessage(text);
      } else if (level === 'warn') {
        void vscode.window.showWarningMessage(text);
      } else {
        void vscode.window.showInformationMessage(text);
      }
    }

    this.clear();
  }
}

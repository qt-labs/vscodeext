// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import { Logger, createLogger } from './logger';

export function createWrappedLogger(tag: string) {
  return new LoggerWrapper(createLogger(tag));
}

interface OutputOptions {
  showMessage: boolean;
  multipleLine: boolean;
}

export const DefaultOutputOptions: OutputOptions = {
  showMessage: false,
  multipleLine: false
};

class LoggerWrapper {
  private _text = '';
  private _outputOptions = DefaultOutputOptions;
  private readonly _data = new Map<string, unknown>();

  constructor(private readonly _logger: Logger) {}

  public text(text: string) {
    this._text = text;
    return this;
  }

  public data(nameOrData: string | Record<string, unknown>, value?: unknown) {
    if (typeof nameOrData === 'string') {
      this._insertData(nameOrData, value);
    } else {
      Object.entries(nameOrData).forEach(([k, v]) => {
        this._insertData(k, v);
      });
    }

    return this;
  }

  public toString() {
    return this._buildSingleLineOutput();
  }

  public setOutputOptions(o: Partial<OutputOptions>) {
    this._outputOptions = {
      ...this._outputOptions,
      ...o
    };
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
  private _insertData(name: string, value: unknown) {
    if (value) {
      this._data.set(name, value);
    }
  }

  private _buildSingleLineOutput() {
    const pairs = [...this._data.entries()]
      .map(([key, value]) => `${key} = ${formatValue(value)}`)
      .join(', ');

    return pairs.length > 0 ? `${this._text}: ${pairs}` : this._text;
  }

  private _logAndClear(
    level: 'error' | 'warn' | 'info' | 'verbose' | 'debug',
    options: Partial<OutputOptions>
  ) {
    const out = this._logger[level].bind(this._logger);
    const o: OutputOptions = { ...this._outputOptions, ...options };

    if (o.multipleLine) {
      out(this._text);

      this._data.forEach((value, key) => {
        out(`- ${key}: ${formatValue(value)}`);
      });
    } else {
      out(this._buildSingleLineOutput());
    }

    const text = o.showMessage ? this._buildSingleLineOutput() : '';

    if (o.showMessage) {
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

// helper
function formatValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (value === undefined) {
    return 'undefined';
  }

  if (value instanceof Error) {
    return value.stack ?? value.message;
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return Object.prototype.toString.call(value);
    }
  }

  // Objects are handled above, so the default stringification is safe.
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  return String(value);
}

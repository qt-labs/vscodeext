// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as winston from 'winston';
import { LogOutputChannelTransport } from 'winston-transport-vscode';

let logger: winston.Logger | undefined = undefined;

export class Logger {
  constructor(private readonly tag: string) {
    this.tag = tag;
  }

  private log(level: keyof winston.Logger, ...message: string[]) {
    if (logger) {
      (logger[level] as (message: string) => void)(
        `[${this.tag}] ${message.join('')}`
      );
    } else {
      console.error('Logger not initialized');
    }
  }

  error(...message: string[]) {
    this.log('error', ...message);
  }

  warn(...message: string[]) {
    this.log('warn', ...message);
  }

  info(...message: string[]) {
    this.log('info', ...message);
  }

  verbose(...message: string[]) {
    this.log('verbose', ...message);
  }

  debug(...message: string[]) {
    this.log('debug', ...message);
  }
}

export function initLogger(extensionName: string) {
  const outputChannel = vscode.window.createOutputChannel(extensionName, {
    log: true
  });
  logger = winston.createLogger({
    levels: LogOutputChannelTransport.config.levels,
    format: LogOutputChannelTransport.format(),
    transports: [new LogOutputChannelTransport({ outputChannel })]
  });
}

export function createLogger(tag: string) {
  return new Logger(tag);
}

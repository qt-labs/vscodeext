// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as winston from 'winston';
import { LogOutputChannelTransport } from 'winston-transport-vscode';

let logger: winston.Logger | undefined = undefined;
let outputChannel: vscode.LogOutputChannel | undefined;

export class Logger {
  constructor(private readonly tag: string) {
    this.tag = tag;
  }

  private log(level: keyof winston.Logger, ...message: string[]) {
    const text = `[${this.tag}] ${message.join('')}`;
    if (logger) {
      (logger[level] as (message: string) => void)(text);
    }
    // Lets CI show logs that otherwise only reach an output channel
    if (process.env.QT_LOG_TO_CONSOLE === '1') {
      console.log(`[${String(level)}] ${text}`);
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
  outputChannel = vscode.window.createOutputChannel(extensionName, {
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

export function getLogOutputChannel(): vscode.LogOutputChannel | undefined {
  return outputChannel;
}

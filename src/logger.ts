// // Copyright (C) 2024 The Qt Company Ltd.
// // SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as winston from 'winston';
import { LogOutputChannelTransport } from 'winston-transport-vscode';

const outputChannel = vscode.window.createOutputChannel('Qt Extension', {
  log: true
});

const logger = winston.createLogger({
  levels: LogOutputChannelTransport.config.levels,
  format: LogOutputChannelTransport.format(),
  transports: [new LogOutputChannelTransport({ outputChannel })]
});

export class Logger {
  constructor(private readonly tag: string) {
    this.tag = tag;
  }
  error(...message: string[]) {
    logger.error(`[${this.tag}] ${message.join('')}`);
  }
  warn(...message: string[]) {
    logger.warn(`[${this.tag}] ${message.join('')}`);
  }
  info(...message: string[]) {
    logger.info(`[${this.tag}] ${message.join('')}`);
  }
  verbose(...message: string[]) {
    logger.verbose(`[${this.tag}] ${message.join('')}`);
  }
  debug(...message: string[]) {
    logger.debug(`[${this.tag}] ${message.join('')}`);
  }
}

export function createLogger(tag: string) {
  return new Logger(tag);
}

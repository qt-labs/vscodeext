// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as childProcess from 'child_process';
import { randomUUID } from 'crypto';
import axios, { AxiosRequestConfig, isAxiosError } from 'axios';

import { createLogger, IsWindows } from 'qt-lib';
import { findQtcliExePath } from '@/qtcli/commands';
import { isErrorResponse, Issue } from '@/webview/shared/message';

const logger = createLogger('qtcli');

const heartbeat_client_ms = 15_000;
const heartbeat_server_arg = '15s';

export function generateSocketId(prefix = ''): string {
  const id = randomUUID().replace(/-/g, '').slice(0, 10);
  return `${prefix || 'vscode'}-${id}`;
}

export class QtcliRestClient {
  private readonly _api: axios.AxiosInstance;
  private readonly _maxRetries = 75;
  private readonly _retryDelay = 100;
  private readonly _timerId: ReturnType<typeof setInterval> | undefined;

  constructor(socketName: string) {
    logger.info(`Creating a client. socket = ${socketName}`);

    this._api = axios.create({
      baseURL: 'http://unix',
      timeout: 15 * 1000,
      socketPath: !IsWindows
        ? `/tmp/qtcli/${socketName}.sock`
        : String.raw`\\.\pipe\qtcli` + `\\${socketName}.pipe`
    });

    this._timerId = setInterval(() => {
      void this.post('/heartbeat');
    }, heartbeat_client_ms);
  }

  dispose() {
    void this.delete('/server');

    if (this._timerId) {
      clearInterval(this._timerId);
    }
  }

  // convenients
  public async get(url: string, params?: unknown) {
    return this.call({ method: 'get', url, params });
  }

  public async post(url: string, data?: unknown, params?: unknown) {
    return this.call({ method: 'post', url, data, params });
  }

  public async put(url: string, data?: unknown, params?: unknown) {
    return this.call({ method: 'put', url, data, params });
  }

  public async patch(url: string, data?: unknown) {
    return this.call({ method: 'patch', url, data });
  }

  public async delete(url: string, data?: unknown) {
    return this.call({ method: 'delete', url, data });
  }

  public async call<T = unknown>(req: AxiosRequestConfig): Promise<T> {
    try {
      const res = await this._api<T>(makeV1Prefix(req));
      return res.data;
    } catch (e) {
      throw QtcliRestError.from(e);
    }
  }

  public async retryCall<T = unknown>(
    req: AxiosRequestConfig,
    remainingRetries = this._maxRetries
  ): Promise<T> {
    try {
      return await this.call<T>(req);
    } catch (e) {
      if (remainingRetries > 0) {
        console.log(
          `Retrying '${String(req.method?.toUpperCase())} ${String(req.url)}' ` +
            `in ${String(this._retryDelay)}ms...`
        );

        await new Promise((resolve) => setTimeout(resolve, this._retryDelay));
        return this.retryCall(req, remainingRetries - 1);
      }

      throw QtcliRestError.from(e);
    }
  }
}

export class QtcliRestError extends Error {
  constructor(
    message: string,
    public details: Issue[] = []
  ) {
    super(message);
    this.name = 'QtcliRestError';
    Object.setPrototypeOf(this, QtcliRestError.prototype);
  }

  public static from(e: unknown) {
    let message = '';
    let details: Issue[] = [];

    if (isAxiosError(e)) {
      const data = e.response?.data as unknown;
      if (isErrorResponse(data)) {
        message = data.error;
        details = data.details ?? [];
      } else {
        message = e.message;
        details = [
          {
            level: 'error',
            field: 'method',
            message: (e.config?.method ?? '').toUpperCase()
          },
          {
            level: 'error',
            field: 'url',
            message: e.config?.url ?? ''
          }
        ];
      }
    } else {
      message = e instanceof Error ? e.message : String(e);
    }

    return new QtcliRestError(message, details);
  }

  public override toString(): string {
    const all = this.details.map((d) => d.message).join(', ');
    return all.length > 0 ? `${this.message} - ${all}` : this.message;
  }
}

export class QtcliRestServer {
  constructor(private readonly _socketId: string) {}

  get socketId() {
    return this._socketId;
  }

  get socketName() {
    return `qtcli-uds-${this._socketId}`;
  }

  public async start(context: vscode.ExtensionContext) {
    logger.info(`Starting a server. socket = ${this.socketName}`);

    const execPath = await findQtcliExePath(context.extensionUri);
    if (!execPath) {
      logger.error('Cannot locate qtcli executable');
      return;
    }

    const args = [
      'server',
      'start',
      '--exit-on-idle',
      '--heartbeat',
      heartbeat_server_arg,
      '--socket',
      this._socketId
    ];

    void runQtcli(execPath, args, this._onOutputFromQtcli.bind(this));
  }

  private _onOutputFromQtcli(line: string) {
    // eslint-disable-next-line no-control-regex
    const removeAnsiColor = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, '');
    logger.info(`${this._socketId}: `, removeAnsiColor(line));
  }
}

// helpers
function makeV1Prefix(req: AxiosRequestConfig): AxiosRequestConfig {
  const raw = req.url?.trim();
  const url =
    raw && !raw.startsWith('/v1/')
      ? '/v1' + (raw.startsWith('/') ? raw : '/' + raw)
      : raw;

  return { ...req, url: url ?? '' };
}

async function runQtcli(
  command: string,
  args: string[],
  onOutput: (line: string) => void
) {
  logger.info(`Run qtcli: ${command} ${args.join(' ')}`);

  const proc = childProcess.spawn(command, args);
  const outPromise = streamToLines(proc.stdout, onOutput);
  const errPromise = streamToLines(proc.stderr, onOutput);

  await new Promise<void>((resolve, reject) => {
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Process exited with code ${String(code)}`));
    });
  });

  const out = await outPromise;
  const err = await errPromise;
  void err;

  return out;
}

type Stream = NodeJS.ReadableStream;
type Callback = ((line: string) => void) | undefined;

async function streamToLines(stream: Stream, callback: Callback) {
  let leftover = '';
  const lines: string[] = [];

  for await (const chunk of stream) {
    const text = leftover + chunk.toString();
    const parts = text.split('\n');
    leftover = parts.pop() ?? '';

    for (const line of parts) {
      const trimmed = line.trim();
      lines.push(trimmed);
      callback?.(trimmed);
    }
  }

  if (leftover.trim()) {
    const trimmed = leftover.trim();
    lines.push(trimmed);
    callback?.(trimmed);
  }

  return lines;
}

// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import os from 'os';
import axios, { AxiosRequestConfig, isAxiosError } from 'axios';

import { ErrorResponse, Issue } from '@/webview/shared/types';

// axios wrapper
export class QtcliRestClient {
  readonly _api = axios.create({
    baseURL: 'http://unix',
    timeout: 15 * 1000,
    socketPath:
      os.platform() !== 'win32'
        ? '/tmp/qtcli/qtcli-server.sock'
        : String.raw`\\.\pipe\qtcli\qtcli-server.pipe`
  });

  private readonly _maxRetries = 20;
  private readonly _retryDelay = 200;

  // convenients
  public async get(url: string, params?: unknown) {
    return this.call({ method: 'get', url, params });
  }

  public async post(url: string, data?: unknown, params?: unknown) {
    return this.call({ method: 'post', url, data, params });
  }

  public async delete(url: string) {
    return this.call({ method: 'delete', url });
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
          `Retrying '${req.method?.toUpperCase()} ${req.url}' ` +
            `in ${this._retryDelay}ms...`
        );

        await new Promise((resolve) => setTimeout(resolve, this._retryDelay));
        return this.retryCall(req, remainingRetries - 1);
      }

      throw QtcliRestError.from(e);
    }
  }
}

export class QtcliRestError extends Error {
  public details = [] as Issue[];

  constructor(message: string, details?: Issue[]) {
    super(message);
    this.name = 'QtcliRestError';

    if (details) {
      this.details = details;
    }
  }

  public static from(e: unknown) {
    if (isAxiosError<ErrorResponse>(e)) {
      const data = e.response?.data;
      if (data) {
        return new QtcliRestError(data.error, data.details);
      }
    }

    return new QtcliRestError(e instanceof Error ? e.message : String(e));
  }

  public override toString(): string {
    const details = this.details.map((d) => d.message).join(', ');
    return details ? `${this.message} - ${details}` : this.message;
  }
}

function makeV1Prefix(req: AxiosRequestConfig): AxiosRequestConfig {
  const raw = req.url?.trim();
  const url =
    raw && !raw.startsWith('/v1/')
      ? '/v1' + (raw.startsWith('/') ? raw : '/' + raw)
      : raw;

  return { ...req, url: url ?? '' };
}

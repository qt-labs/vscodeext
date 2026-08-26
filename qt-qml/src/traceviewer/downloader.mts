// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { IsMacOS, IsLinux, IsWindows, Isx64, IsArm64 } from 'qt-lib';
import { Progress, ProgressUpdater } from './helpers/progress.mts';
import { createWrappedLogger } from './helpers/logger-wrapper.ts';
import * as consts from './constants.mts';

type WebStream = import('node:stream/web').ReadableStream;
const logger = createWrappedLogger('traceviewer-downloader');

export interface DownloadResult {
  result: 'downloaded' | 'up-to-date';
  id: string;
  sourceUrl: string;
  downloadedDir: string;
  downloadedFilePath: string;
}

export async function downloadWithProgress(latestId: string | undefined) {
  const sourceUrls = resolvePackageUrls();
  const downloadedFilePath = createDownloadFilePath();
  let sourceUrl = '';
  let id = '';
  let isUpToDate = false;

  const taskOptions = {
    title: 'Downloading QML trace viewer',
    location: vscode.ProgressLocation.Notification,
    cancellable: true
  };

  const task = async (progress_: Progress, token: vscode.CancellationToken) => {
    const abortController = new AbortController();
    const abortOptions = { signal: abortController.signal };
    token.onCancellationRequested(() => {
      abortController.abort();
    });

    const { url, res } = await fetchFirstAvailable(sourceUrls, abortOptions);
    sourceUrl = url;
    id = createIdFromHeaders(res.headers);
    if (latestId && latestId === id) {
      isUpToDate = true;
      return;
    }

    const length = Number.parseInt(res.headers.get('content-length') ?? '0');
    const progress = new ProgressUpdater(progress_, length);

    await pipeline(
      Readable.fromWeb(res.body as WebStream),
      async function* (source: AsyncIterable<Buffer>) {
        for await (const chunk of source) {
          yield chunk;
          progress.increase(chunk.length);
        }
      },
      fs.createWriteStream(downloadedFilePath, { mode: 0o600 }),
      abortOptions
    );
  };

  await vscode.window.withProgress(taskOptions, task);

  return {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    result: isUpToDate ? 'up-to-date' : 'downloaded',
    id,
    sourceUrl,
    downloadedDir: path.dirname(downloadedFilePath),
    downloadedFilePath
  } as DownloadResult;
}

// helpers
export function resolvePackageUrls() {
  const os_ = IsMacOS ? 'mac' : IsWindows ? 'windows' : IsLinux ? 'linux' : '';
  const arch = Isx64 || IsMacOS ? 'x64' : IsArm64 ? 'arm64' : '';
  if (!os_ || !arch) {
    throw new Error('Unsupported platform');
  }

  const base = vscode.Uri.parse(consts.DOWNLOAD_HOST);
  return consts.PACKAGE_CANDIDATES.map((candidate) =>
    vscode.Uri.joinPath(
      base,
      consts.DOWNLOAD_DIR_BASE,
      `${os_}_${arch}`,
      candidate.file
    ).toString()
  );
}

export async function fetchFirstAvailable(
  urls: string[],
  init?: RequestInit,
  fetchFn: (
    url: string,
    init?: RequestInit
  ) => Promise<Response> = fetchAndCheck
) {
  const failures: string[] = [];
  for (const url of urls) {
    try {
      return { url, res: await fetchFn(url, init) };
    } catch (e) {
      if (init?.signal?.aborted) {
        throw e;
      }

      const message = e instanceof Error ? e.message : String(e);
      failures.push(`${url}: ${message}`);
      logger
        .text('Package candidate is not available')
        .data('url', url)
        .data('error', message)
        .warn();
    }
  }

  throw new Error(`All download candidates failed: ${failures.join('; ')}`);
}

function createDownloadFilePath() {
  const dir = path.join(os.tmpdir(), 'qmltraceviewer');
  const fileName = `qmltraceviewer-${crypto.randomUUID()}.zip`;

  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, fileName);
}

// download.qt.io redirects file downloads to a changing set of third-party
// mirrors, so the hosts cannot be pinned here. Follow redirects manually
// instead of letting fetch do it, so every hop can be forced to stay on
// https and a redirect cannot downgrade the transfer to cleartext.
const MaxRedirects = 10;

async function fetchHttpsOnly(url: string, init?: RequestInit) {
  let current = new URL(url);
  for (let i = 0; i < MaxRedirects; ++i) {
    if (current.protocol !== 'https:') {
      throw new Error(`Refusing non-https download URL: ${current.toString()}`);
    }

    const res = await fetch(current, { ...init, redirect: 'manual' });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) {
        throw new Error(`Redirect without a location: ${String(res.status)}`);
      }
      await res.body?.cancel();
      current = new URL(location, current);
      continue;
    }

    return res;
  }

  throw new Error('Download exceeded the maximum number of redirects');
}

async function fetchAndCheck(url: string, init?: RequestInit) {
  const res = await fetchHttpsOnly(url, init);
  const fail = async (message: string) => {
    await res.body?.cancel();
    return new Error(message);
  };

  if (!res.ok) {
    throw await fail(`Invalid status code: ${res.statusText}`);
  }

  const contentType = res.headers.get('content-type');
  if (contentType !== consts.DOWNLOAD_CONTENT_TYPE) {
    throw await fail(`Invalid content type: ${contentType ?? '-'}`);
  }

  const contentLength = res.headers.get('content-length');
  const maxBytes = Number.parseInt(contentLength ?? '0');
  if (maxBytes <= 0) {
    throw await fail(`Invalid content length: ${String(maxBytes)}`);
  }

  return res;
}

function createIdFromHeaders(headers: Headers): string {
  const lastModified = headers.get('last-modified');
  const timestamp = lastModified
    ? new Date(lastModified).getTime()
    : Date.now();

  return String(Math.floor(timestamp / 1000));
}

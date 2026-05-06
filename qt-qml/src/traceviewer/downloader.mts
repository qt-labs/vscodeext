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
import * as consts from './constants.mts';

type WebStream = import('node:stream/web').ReadableStream;

export interface DownloadResult {
  result: 'downloaded' | 'up-to-date';
  id: string;
  sourceUrl: string;
  downloadedDir: string;
  downloadedFilePath: string;
}

export async function downloadWithProgress(latestId: string | undefined) {
  const sourceUrl = resolvePackageUrl();
  const downloadedFilePath = createDownloadFilePath();
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

    const res = await fetchAndCheck(sourceUrl, abortOptions);
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
function resolvePackageUrl() {
  const os_ = IsMacOS ? 'mac' : IsWindows ? 'windows' : IsLinux ? 'linux' : '';
  const arch = Isx64 || IsMacOS ? 'x64' : IsArm64 ? 'arm64' : '';
  if (!os_ || !arch) {
    throw new Error('Unsupported platform');
  }

  const base = vscode.Uri.parse(consts.DOWNLOAD_HOST);
  return vscode.Uri.joinPath(
    base,
    consts.DOWNLOAD_DIR_BASE,
    `${os_}_${arch}`,
    consts.DOWNLOAD_FILE
  ).toString();
}

function createDownloadFilePath() {
  const dir = path.join(os.tmpdir(), 'qmltraceviewer');
  const fileName = `qmltraceviewer-${crypto.randomUUID()}.zip`;

  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, fileName);
}

async function fetchAndCheck(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`Invalid status code: ${res.statusText}`);
  }

  const contentType = res.headers.get('content-type');
  if (contentType !== consts.DOWNLOAD_CONTENT_TYPE) {
    throw new Error(`Invalid content type: ${contentType ?? '-'}`);
  }

  const contentLength = res.headers.get('content-length');
  const maxBytes = Number.parseInt(contentLength ?? '0');
  if (maxBytes <= 0) {
    throw new Error(`Invalid content length: ${String(maxBytes)}`);
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

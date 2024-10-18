// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';

export async function download(
  url: string,
  destPath: string,
  token?: vscode.CancellationToken,
  reportCallback?: (progress: number, max: number) => void
) {
  let downloadUrl = url;
  const MaxRedirects = 10;

  for (let i = 0; i < MaxRedirects; ++i) {
    if (!downloadUrl) {
      throw Error('Invalid download URL');
    }

    const res = await getHttps(downloadUrl);
    if (!res.statusCode) {
      throw Error(`Invalid status code ${res.statusCode}`);
    }

    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      downloadUrl = res.headers.location;
      continue;
    }

    return downloadOctetStream(res, destPath, token, reportCallback);
  }
}

async function downloadOctetStream(
  res: http.IncomingMessage,
  destPath: string,
  token?: vscode.CancellationToken,
  reportCallback?: (progress: number, max: number) => void
) {
  return new Promise<void>((resolve, reject) => {
    if (!res.statusCode) {
      reject(new Error('No response'));
      return;
    }

    if (token) {
      token.onCancellationRequested(() => {
        reject(new Error('User canceled'));
      });
    }

    if (res.statusCode < 200 || res.statusCode >= 300) {
      reject(new Error(`Unexpected status, ${res.statusCode}`));
      return;
    }

    if (res.headers['content-type'] !== 'application/octet-stream') {
      reject(new Error('HTTP response does not contain an octet stream'));
      return;
    }

    const fileStream = fs.createWriteStream(destPath, { mode: 0o600 });
    const pipeStream = res.pipe(fileStream);
    pipeStream.on('finish', resolve);
    pipeStream.on('error', reject);
    res.on('error', reject);

    if (reportCallback) {
      const length = res.headers['content-length'];
      const maxBytes = length ? Number.parseInt(length) : 100;
      let downloadedBytes = 0;

      res.on('data', (chunk) => {
        downloadedBytes += (chunk as Buffer).length;
        reportCallback(downloadedBytes, maxBytes);
      });
    }
  });
}

async function getHttps(url: string) {
  return new Promise<http.IncomingMessage>((resolve, reject) => {
    const request = https.get(url, resolve);
    request.on('error', reject);
  });
}

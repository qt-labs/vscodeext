// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';

// The download URL comes from a remote release manifest and every redirect
// hop comes from a remote server, so each of them is untrusted input. Pin
// the whole chain to https and to hosts Qt publishes releases through, or a
// tampered manifest or redirect could send the request anywhere.
const AllowedDownloadHosts = ['github.com', 'githubusercontent.com', 'qt.io'];

export function checkedDownloadUrl(url: string | URL, base?: URL): URL {
  const parsed = new URL(url, base);
  if (parsed.protocol !== 'https:') {
    throw new Error(`Refusing non-https download URL: ${parsed.toString()}`);
  }
  const host = parsed.hostname;
  const allowed = AllowedDownloadHosts.some(
    (domain) => host === domain || host.endsWith(`.${domain}`)
  );
  if (!allowed) {
    throw new Error(`Refusing download from unexpected host: ${host}`);
  }
  return parsed;
}

export async function download(
  url: string,
  destPath: string,
  token?: vscode.CancellationToken,
  reportCallback?: (progress: number, max: number) => void
) {
  let downloadUrl = checkedDownloadUrl(url);
  const MaxRedirects = 10;
  const controller = new AbortController();
  token?.onCancellationRequested(() => {
    controller.abort();
  });

  for (let i = 0; i < MaxRedirects; ++i) {
    const res = await getHttps(downloadUrl.toString(), controller);
    if (!res.statusCode) {
      throw Error(`Invalid status code ${res.statusCode?.toString() ?? ''}`);
    }

    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      res.resume();
      downloadUrl = checkedDownloadUrl(res.headers.location, downloadUrl);
      continue;
    }

    return downloadOctetStream(res, destPath, token, reportCallback);
  }

  throw new Error('Download exceeded the maximum number of redirects');
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

    token?.onCancellationRequested(() => {
      reject(new Error('User canceled'));
    });

    if (res.statusCode < 200 || res.statusCode >= 300) {
      reject(new Error(`Unexpected status, ${res.statusCode.toString()}`));
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

async function getHttps(url: string, controller: AbortController) {
  return new Promise<http.IncomingMessage>((resolve, reject) => {
    const request = https.get(url, { signal: controller.signal }, resolve);
    request.on('error', reject);
  });
}

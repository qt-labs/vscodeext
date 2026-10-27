// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import { ServerResponse as HttpRes } from 'http';

import { createWrappedLogger } from 'qt-lib';
import { getScriptToInject } from './script-to-inject';

export interface HttpContext {
  req: {
    filePath: string;
    fileName: string;
  };
  res: HttpRes;
  logger: ReturnType<typeof createWrappedLogger>;
}

export function sendData(c: HttpContext, data: unknown) {
  const headers = {
    'Content-Type': getMimeType(c.req.fileName)
  };

  c.res.writeHead(200, headers);
  c.res.end(data);
}

export function sendNotFound(c: HttpContext) {
  c.res.writeHead(404);
  c.res.end(createErrorPage(404));
  c.logger
    .text('Not found')
    .data({ ...c })
    .error();
}

export function sendForbidden(c: HttpContext) {
  c.res.writeHead(403);
  c.res.end(createErrorPage(403));
  c.logger
    .text('Forbidden')
    .data({ ...c })
    .error();
}

// helpers
function createErrorPage(code: number) {
  return /*html*/ `
    <!DOCTYPE html>
    <html>
      <head>${getScriptToInject()}</head>
      <body data-error-code='${String(code)}'></body>
    </html>
  `;
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2'
  };

  return map[ext] ?? 'application/octet-stream';
}

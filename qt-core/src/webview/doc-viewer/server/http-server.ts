// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as net from 'net';
import * as path from 'path';
import * as http from 'http';
import { Uri, Disposable } from 'vscode';

import { createWrappedLogger, DisposableStore } from 'qt-lib';
import { fsFile } from '@/fs-utils';
import { DocViewerCssManager } from './css-manager';
import { HttpContext, sendForbidden } from './common';
import {
  type HandlerFunc,
  replaceCss,
  handleFallback,
  injectScriptToHtml
} from './handler-funcs';

const logger = createWrappedLogger('doc-viewer-server');

export class DocViewerHttpServer implements Disposable {
  private _server: http.Server | undefined;
  private readonly _handlers: HandlerFunc[] = [];
  private readonly _cssManager: DocViewerCssManager;
  private readonly _disposables = new DisposableStore();

  constructor() {
    this._cssManager = new DocViewerCssManager();
    this._handlers.push(
      (c: HttpContext) => replaceCss(c, this._cssManager.cssContent),
      injectScriptToHtml,
      handleFallback
    );

    this._disposables.push(this._cssManager);
  }

  dispose(): void {
    if (this._server) {
      this._server.close();
      logger
        .text('Server closing')
        .data('address', addrToString(this._server))
        .info();
    }

    this._disposables.dispose();
  }

  public cssManager() {
    return this._cssManager;
  }

  public get baseUri(): Uri {
    return Uri.from({
      scheme: this._scheme,
      authority: this._authority
    });
  }

  public getRedirectUri(uri: Uri) {
    if (uri.scheme === 'file') {
      return uri.with({
        scheme: this._scheme,
        authority: this._authority
      });
    }

    return uri;
  }

  public matchesOrigin(uri: Uri) {
    return uri.scheme === this._scheme && uri.authority === this._authority;
  }

  async start(): Promise<void> {
    if (this._server) {
      logger
        .text('Server is already running')
        .data('address', addrToString(this._server))
        .debug();

      return;
    }

    this._server = http.createServer((req, res) => {
      this._dispatch(req, res);
    });

    this._server.on('connection', () => {
      logger.text('Server connection').data('port', this._port).info();
    });

    this._server.on('close', () => {
      logger.text('Server close').data('port', this._port).info();
    });

    return new Promise((resolve, reject) => {
      if (this._server) {
        const anyPort = 0;
        this._server.once('error', reject);
        this._server.listen(anyPort, this._host, () => {
          logger.text('Server listening...').data('port', this._port).info();

          resolve();
        });

        return;
      }

      reject(new Error('Server instance is invalid'));
    });
  }

  private _dispatch(req: http.IncomingMessage, res: http.ServerResponse) {
    const filePath = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '');
    const c: HttpContext = {
      req: {
        filePath,
        fileName: path.basename(filePath)
      },
      res,
      logger
    };

    if (!canAccess(filePath)) {
      sendForbidden(c);
      return;
    }

    for (const handler of this._handlers) {
      if (handler(c)) {
        return;
      }
    }
  }

  private readonly _scheme = 'http';
  private readonly _host = '127.0.0.1';

  private get _authority() {
    const p = this._port;
    return p ? `${this._host}:${String(this._port)}` : '';
  }

  private get _port(): number | undefined {
    const addr = this._server?.address();
    return typeof addr === 'object' ? addr?.port : undefined;
  }
}

// helpers
function addrToString(server: net.Server | undefined) {
  const addr = server?.address();
  if (typeof addr === 'string') {
    return addr;
  }

  return addr ? `${addr.address}:${String(addr.port)}` : '';
}

function canAccess(filePath: string): boolean {
  return fsFile(filePath).exists();
}

// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import {
  window,
  Disposable,
  WebviewPanel,
  TextDocument,
  ExtensionContext,
  CancellationToken,
  CustomTextEditorProvider
} from 'vscode';

import { EXTENSION_ID } from '@/constants';
import {
  createWebviewHtml,
  createWebviewOptions,
  basicWebviewAppConfig
} from '@/webview/utils';
import { QrcDocsManager } from './docs-manager';
import { QrcEditorController } from './controller';

export function registerQrcEditorProvider(context: ExtensionContext) {
  const type = `${EXTENSION_ID}.qrcEditor`;
  const provider = new QrcEditorProvider(context);
  const reg = window.registerCustomEditorProvider(type, provider);

  context.subscriptions.push(...[provider, reg]);
}

class QrcEditorProvider implements CustomTextEditorProvider {
  private readonly _context: ExtensionContext;
  private readonly _docsManager = new QrcDocsManager();
  private readonly _controllers = new Map<WebviewPanel, QrcEditorController>();
  private readonly _disposables: Disposable[] = [];

  constructor(context: ExtensionContext) {
    this._context = context;
    this._disposables.push(this._docsManager);
  }

  public dispose() {
    this._disposables.forEach((e) => {
      e.dispose();
    });
  }

  public async resolveCustomTextEditor(
    doc: TextDocument,
    panel: WebviewPanel,
    token: CancellationToken
  ): Promise<void> {
    void token;

    // view
    const config = {
      app: 'qrc-editor',
      title: 'QRC editor',
      context: this._context,
      ...basicWebviewAppConfig
    };

    const view = panel.webview;
    view.html = createWebviewHtml(view, config);
    view.options = createWebviewOptions(config);

    // doc
    this._docsManager.add(doc);

    // controller
    const controller = new QrcEditorController(
      view,
      this._docsManager,
      doc.uri.fsPath
    );

    this._controllers.set(panel, controller);
    panel.onDidDispose(() => {
      controller.dispose();
      this._controllers.delete(panel);
    });

    return Promise.resolve();
  }
}

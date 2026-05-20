// Copyright (C) 2026 The Qt Company Ltd.
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

import { telemetry } from 'qt-lib';
import {
  createWebviewHtml,
  createWebviewOptions,
  basicWebviewAppConfig,
  createWebviewPanelIcons
} from '@/webview/utils';
import { EXTENSION_ID } from '@/constants';
import { UiFileDocsManager } from './docs-manager';
import { UiFileController } from './controller';

export function registerUiFileEditorProvider(context: ExtensionContext) {
  const type = `${EXTENSION_ID}.uiFile`;
  const provider = new UiFileEditorProvider(context);
  const reg = window.registerCustomEditorProvider(type, provider);

  context.subscriptions.push(...[provider, reg]);
}

class UiFileEditorProvider implements CustomTextEditorProvider {
  private readonly _context: ExtensionContext;
  private readonly _docsManager = new UiFileDocsManager();
  private readonly _controllers = new Map<WebviewPanel, UiFileController>();
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
      app: 'ui-file',
      title: 'UI file',
      context: this._context,
      ...basicWebviewAppConfig
    };

    panel.iconPath = createWebviewPanelIcons(this._context);
    panel.webview.html = createWebviewHtml(panel.webview, config);
    panel.webview.options = createWebviewOptions(config);

    // doc
    this._docsManager.add(doc);

    // controller
    const controller = new UiFileController(panel, this._docsManager, doc.uri);
    this._controllers.set(panel, controller);

    panel.onDidDispose(() => {
      controller.dispose();
      this._controllers.delete(panel);
    });

    telemetry.sendEvent('UIFile:resolveCustomTextEditor');
    return Promise.resolve();
  }
}

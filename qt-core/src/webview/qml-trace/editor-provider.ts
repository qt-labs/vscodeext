// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import {
  Uri,
  window,
  WebviewPanel,
  ExtensionContext,
  CancellationToken,
  CustomReadonlyEditorProvider,
  CustomDocumentOpenContext
} from 'vscode';

import { getQtQmlApi } from 'qt-lib';
import {
  createWebviewHtml,
  createWebviewOptions,
  basicWebviewAppConfig,
  createWebviewPanelIcons
} from '@/webview/utils';
import { EXTENSION_ID } from '@/constants';
import { QmlTraceDoc } from './doc';
import { QmlTraceController } from './controller';
import * as texts from '@/texts';

export function registerQmlTraceProvider(context: ExtensionContext) {
  const type = `${EXTENSION_ID}.qmlTrace`;
  const provider = new QmlTraceProvider(context);
  const reg = window.registerCustomEditorProvider(type, provider);

  context.subscriptions.push(...[provider, reg]);
}

class QmlTraceProvider implements CustomReadonlyEditorProvider<QmlTraceDoc> {
  private readonly _context: ExtensionContext;
  private readonly _controllers = new Map<WebviewPanel, QmlTraceController>();

  constructor(context: ExtensionContext) {
    this._context = context;
  }

  // eslint-disable-next-line
  public dispose() {}

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  public openCustomDocument(
    uri: Uri,
    openContext: CustomDocumentOpenContext,
    token: CancellationToken
  ): QmlTraceDoc | Thenable<QmlTraceDoc> {
    void openContext;
    void token;
    return new QmlTraceDoc(uri);
  }

  public async resolveCustomEditor(
    doc: QmlTraceDoc,
    panel: WebviewPanel,
    token: CancellationToken
  ): Promise<void> {
    void token;

    // view
    const config = {
      app: 'qml-trace',
      title: texts.qmlTrace.tabText,
      context: this._context,
      ...basicWebviewAppConfig
    };

    panel.iconPath = createWebviewPanelIcons(this._context);
    panel.webview.html = createWebviewHtml(panel.webview, config);
    panel.webview.options = createWebviewOptions(config);

    // controller
    const controller = new QmlTraceController(doc, panel);
    this._controllers.set(panel, controller);

    panel.onDidDispose(async () => {
      (await getQtQmlApi())?.traceFile.close(doc.uri);
      controller.dispose();
      this._controllers.delete(panel);
    });

    return Promise.resolve();
  }
}

// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import {
  Uri,
  window,
  WebviewPanel as Panel,
  ExtensionContext as Context,
  CancellationToken as Token,
  CustomDocumentOpenContext as DocContext,
  CustomReadonlyEditorProvider as EditorProvider
} from 'vscode';

import { getQtQmlApi } from 'qt-lib';
import { setupWebApp } from '@/webview/utils';
import { EXTENSION_ID } from '@/constants';
import { QmlTraceDoc as Doc } from './doc';
import { QmlTraceController as Controller } from './controller';

export function addQmlTraceFileSupport(context: Context) {
  const type = `${EXTENSION_ID}.qmlTrace`;
  const provider = new QmlTraceEditorProvider(context);

  context.subscriptions.push(
    provider,
    window.registerCustomEditorProvider(type, provider)
  );
}

class QmlTraceEditorProvider implements EditorProvider<Doc> {
  private readonly _controllers = new Map<Panel, Controller>();

  constructor(private readonly _context: Context) {}

  // eslint-disable-next-line
  public dispose() {}

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  public openCustomDocument(uri: Uri, openContext: DocContext, token: Token) {
    void openContext;
    void token;
    return new Doc(uri);
  }

  public async resolveCustomEditor(doc: Doc, panel: Panel, token: Token) {
    void token;

    setupWebApp('qml-trace', this._context, panel);
    const controller = new Controller(doc, panel);
    this._controllers.set(panel, controller);

    panel.onDidDispose(async () => {
      (await getQtQmlApi())?.traceFile.close(doc.uri);
      controller.dispose();
      this._controllers.delete(panel);
    });

    return Promise.resolve();
  }
}

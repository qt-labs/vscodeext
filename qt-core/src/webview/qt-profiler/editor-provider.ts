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
import * as path from 'path';

import { setupWebApp, exposeDirs } from '@/webview/utils';
import { EXTENSION_ID } from '@/constants';
import { QtProfilerDoc as Doc } from './doc';
import { QtProfilerController as Controller } from './controller';

export function addQtProfilerSupport(context: Context) {
  const type = `${EXTENSION_ID}.qtProfiler`;
  const provider = new QtProfilerEditorProvider(context);

  context.subscriptions.push(
    provider,
    window.registerCustomEditorProvider(type, provider, {
      webviewOptions: { retainContextWhenHidden: true }
    })
  );
}

class QtProfilerEditorProvider implements EditorProvider<Doc> {
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

    const qtProfilerDistUri = Uri.file(
      path.join(this._context.extensionPath, 'res/others/qtprofiler')
    );

    setupWebApp('qt-profiler', this._context, panel);
    exposeDirs(panel, [qtProfilerDistUri]);

    const controller = new Controller(doc, panel, qtProfilerDistUri);
    this._controllers.set(panel, controller);

    panel.onDidDispose(() => {
      controller.dispose();
      this._controllers.delete(panel);
    });

    return Promise.resolve();
  }
}

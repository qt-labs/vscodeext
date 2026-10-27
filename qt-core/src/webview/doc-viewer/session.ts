// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import {
  commands,
  ViewColumn,
  WebviewPanel as Panel,
  ExtensionContext as Context
} from 'vscode';

import { DisposableStore } from 'qt-lib';
import { setupWebApp } from '@/webview/utils';
import { OpenOptions } from '../shared/doc-viewer';
import { DocViewerDispatcher } from './dispatcher';
import { docViewerInfra as infra } from './infra';
import * as consts from './constants';

export class DocViewerSession {
  private readonly _dispatcher: DocViewerDispatcher;
  private readonly _disposables = new DisposableStore();

  constructor(
    context: Context,
    private readonly _panel: Panel,
    openOptions: OpenOptions
  ) {
    setupWebApp(consts.AppId, context, this._panel);

    this._dispatcher = new DocViewerDispatcher(
      context,
      this._panel,
      infra,
      openOptions
    );

    this._disposables.push(
      this._dispatcher,
      this._panel.onDidDispose(this.dispose.bind(this))
    );
  }

  public dispose() {
    this._disposables.dispose();
  }

  public get currentUri() {
    return this._dispatcher.currentUri;
  }

  public get viewColumn() {
    return this._panel.viewColumn;
  }

  public reveal(viewColumn?: ViewColumn, preserveFocus?: boolean) {
    this._panel.reveal(viewColumn, preserveFocus);

    // to remove preview mode
    void commands.executeCommand('workbench.action.keepEditor');
  }
}

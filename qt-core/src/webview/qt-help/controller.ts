// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import {
  commands,
  Disposable,
  WebviewPanel as Panel,
  ExtensionContext as Context
} from 'vscode';

import { telemetry, DisposableStore } from 'qt-lib';
import { setupWebApp, createPanel } from '@/webview/utils';
import { docViewerInfra as infra } from '@/webview/doc-viewer/infra';
import { QtHelpDispatcher } from './dispatcher';
import * as consts from './constants';

let instance: QtHelpController | undefined;

export function addQtHelp(context: Context) {
  const openCmd = 'openQtHelp';
  const openCmdFull = `${consts.EXTENSION_ID}.${openCmd}`;

  context.subscriptions.push(
    commands.registerCommand(openCmdFull, () => {
      telemetry.sendAction(openCmd);
      QtHelpController.render(context);
    })
  );
}

export class QtHelpController implements Disposable {
  private readonly _dispatcher: QtHelpDispatcher;
  private readonly _disposables = new DisposableStore();

  private constructor(
    context: Context,
    private readonly _panel: Panel
  ) {
    setupWebApp(consts.AppId, context, this._panel);

    this._dispatcher = new QtHelpDispatcher(context, this._panel, infra);
    this._disposables.push(
      this._dispatcher,
      this._panel.onDidDispose(this.dispose.bind(this))
    );
  }

  public dispose() {
    instance = undefined;
    this._disposables.dispose();
  }

  public static render(context: Context) {
    instance ??= new QtHelpController(context, createPanel(consts.AppId));
    instance._panel.reveal();
  }
}

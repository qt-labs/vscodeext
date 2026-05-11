// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import * as vscode from 'vscode';

import { telemetry } from 'qt-lib';
import { EXTENSION_ID } from '@/constants';
import { QtcliRestServer, generateSocketId } from '@/qtcli/rest';
import {
  WebviewAppConfig,
  createWebviewHtml,
  createWebviewOptions,
  basicWebviewAppConfig,
  createWebviewPanelIcons
} from '@/webview/utils';
import * as texts from '@/texts';
import { ExDataManager } from './data-manager';
import { ExCoreWatcher } from './core-watcher';
import { ExBrowserDispatcher } from './dispatcher';
import * as helpers from './helpers';
import * as consts from './constants';

type Panel = vscode.WebviewPanel;
type Context = vscode.ExtensionContext;

export function registerOpenExBrowserCommand(context: Context) {
  return vscode.commands.registerCommand(
    `${EXTENSION_ID}.openExamplesBrowser`,
    () => {
      telemetry.sendAction('openExamplesBrowser');
      ExBrowserController.render(context);
    }
  );
}

export class ExBrowserController {
  public static instance: ExBrowserController | undefined;

  private readonly _panel: Panel;
  private readonly _data: ExDataManager;
  private readonly _qtcliServer: QtcliRestServer;
  private readonly _dispatcher: ExBrowserDispatcher;
  private readonly _coreWatcher: ExCoreWatcher;
  private readonly _disposables: vscode.Disposable[] = [];

  private constructor(context: Context, panel: Panel) {
    const sources = helpers.findAllPackagePools();
    const config: WebviewAppConfig = {
      app: 'ex-browser',
      title: texts.exBrowser.tabText,
      context,
      ...basicWebviewAppConfig,
      additionalResourceRoots: [
        helpers.fallbackImageDir(context),
        ...sources.flatMap((s) => {
          return [
            vscode.Uri.file(
              s.examplesPath ?? path.join(s.fsPath, consts.EX_DIR_NAME)
            ),
            vscode.Uri.file(
              s.docsPath ?? path.join(s.fsPath, consts.DOCS_DIR_NAME)
            )
          ];
        })
      ]
    };

    panel.iconPath = createWebviewPanelIcons(context);
    panel.webview.html = createWebviewHtml(panel.webview, config);
    panel.webview.options = createWebviewOptions(config);

    this._panel = panel;
    this._data = new ExDataManager(sources);
    this._qtcliServer = new QtcliRestServer(generateSocketId('ex-browser'));
    this._dispatcher = new ExBrowserDispatcher(
      this._data,
      context,
      panel,
      this._qtcliServer.socketName
    );

    this._coreWatcher = new ExCoreWatcher(panel, context);
    void this._qtcliServer.start(context);

    this._disposables = [
      this._data,
      this._dispatcher,
      this._coreWatcher,
      panel.onDidDispose(this.dispose.bind(this))
    ];
  }

  public dispose() {
    ExBrowserController.instance = undefined;
    this._disposables.forEach((d) => void d.dispose());
    this._disposables.length = 0;
  }

  public static render(context: Context) {
    if (!ExBrowserController.instance) {
      ExBrowserController.instance = new ExBrowserController(
        context,
        vscode.window.createWebviewPanel(
          consts.WEBVIEW_PANEL_VIEW_TYPE,
          texts.exBrowser.tabText,
          consts.WEBVIEW_PANEL_COLUMN
        )
      );
    }

    ExBrowserController.instance._panel.reveal(consts.WEBVIEW_PANEL_COLUMN);
  }
}

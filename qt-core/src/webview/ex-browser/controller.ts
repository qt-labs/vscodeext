// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import * as vscode from 'vscode';

import { telemetry, DisposableStore } from 'qt-lib';
import { EXTENSION_ID } from '@/constants';
import { QtcliRestServer, generateSocketId } from '@/qtcli/rest';
import { WebAppId } from '@/webview/shared/types';
import { getWebAppInfo } from '@/webview/info';
import { ExPackagePoolDir } from '@/webview/shared/ex-browser';
import { setupWebApp, createPanel, exposeDirs } from '@/webview/utils';
import { ExDataManager } from './data-manager';
import { ExCoreWatcher } from './core-watcher';
import { ExBrowserDispatcher } from './dispatcher';
import * as helpers from './helpers';
import * as consts from './constants';

type Panel = vscode.WebviewPanel;
type Context = vscode.ExtensionContext;

const appId: WebAppId = 'ex-browser';
let instance: ExBrowserController | undefined;

export function addExBrowser(context: Context) {
  const openCmd = 'openExamplesBrowser';
  const openCmdFull = `${EXTENSION_ID}.${openCmd}`;
  const info = getWebAppInfo(appId);

  context.subscriptions.push(
    vscode.commands.registerCommand(openCmdFull, () => {
      telemetry.sendAction(openCmd);
      ExBrowserController.render(context);
    }),

    vscode.window.registerWebviewPanelSerializer(info.viewType, {
      async deserializeWebviewPanel(panel: Panel) {
        ExBrowserController.restore(context, panel);
        return Promise.resolve();
      }
    })
  );
}

export class ExBrowserController {
  private readonly _data: ExDataManager;
  private readonly _qtcliServer: QtcliRestServer;
  private readonly _dispatcher: ExBrowserDispatcher;
  private readonly _coreWatcher: ExCoreWatcher;
  private readonly _disposables = new DisposableStore();

  private constructor(
    context: Context,
    private readonly _panel: Panel
  ) {
    const sources = helpers.findAllPackagePools();

    setupWebApp(appId, context, this._panel);
    exposeDirs(this._panel, findDocAndExDirs(sources));
    exposeDirs(this._panel, [helpers.fallbackImageDir(context)]);

    this._data = new ExDataManager(sources);
    this._qtcliServer = new QtcliRestServer(generateSocketId('ex-browser'));
    this._dispatcher = new ExBrowserDispatcher(
      this._data,
      context,
      this._panel,
      this._qtcliServer.socketName
    );

    this._coreWatcher = new ExCoreWatcher(this._panel, context);
    void this._qtcliServer.start(context);

    this._disposables.push(
      this._data,
      this._dispatcher,
      this._coreWatcher,
      this._panel.onDidDispose(this.dispose.bind(this))
    );
  }

  public dispose() {
    instance = undefined;
    this._disposables.dispose();
  }

  public static render(context: Context) {
    instance ??= new ExBrowserController(context, createPanel(appId));
    instance._panel.reveal();
  }

  public static restore(context: Context, panel: Panel) {
    if (instance) {
      panel.dispose();
      return;
    }

    instance = new ExBrowserController(context, panel);
  }
}

// helper
function findDocAndExDirs(roots: ExPackagePoolDir[]) {
  function findDirsToExpose(s: ExPackagePoolDir) {
    return [
      vscode.Uri.file(s.docsPath ?? path.join(s.fsPath, consts.DOCS_DIR_NAME)),
      vscode.Uri.file(s.examplesPath ?? path.join(s.fsPath, consts.EX_DIR_NAME))
    ];
  }

  return roots.flatMap((s) => findDirsToExpose(s));
}

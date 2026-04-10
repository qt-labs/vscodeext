// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { telemetry } from 'qt-lib';
import {
  WebviewAppConfig,
  createWebviewHtml,
  createWebviewOptions,
  basicWebviewAppConfig,
  createWebviewPanelIcons
} from '@/webview/utils';
import * as texts from '@/texts';
import { WelcomePageDispatcher as WelcomeScreenDispatcher } from './dispatcher';
import { WelcomePageDataManager } from './data-manager';
import * as consts from './constants';

type Panel = vscode.WebviewPanel;
type Context = vscode.ExtensionContext;

export function registerOpenWelcomePageCommand(context: Context) {
  const name = 'openWelcomePage';
  const cmd = `${consts.EXTENSION_ID}.${name}`;

  return vscode.commands.registerCommand(cmd, () => {
    telemetry.sendAction(name);
    WelcomePageController.render(context);
  });
}

export function tryOpenWelcomePage(context: Context) {
  const key = consts.CONFIG_KEY_SHOW_ON_ACTIVATION;
  const config = vscode.workspace.getConfiguration(consts.EXTENSION_ID);

  if (config.get<boolean>(key) ?? true) {
    WelcomePageController.render(context);
  }
}

export class WelcomePageController {
  public static instance: WelcomePageController | undefined;

  private readonly _panel: Panel;
  private readonly _data: WelcomePageDataManager;
  private readonly _dispatcher: WelcomeScreenDispatcher;
  private readonly _disposables: vscode.Disposable[] = [];

  private constructor(context: Context, panel: Panel) {
    const config: WebviewAppConfig = {
      app: 'welcome',
      title: texts.WelcomePage.tabText,
      context,
      additionalResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, 'res', 'icons')
      ],
      ...basicWebviewAppConfig
    };

    panel.iconPath = createWebviewPanelIcons(context);
    panel.webview.html = createWebviewHtml(panel.webview, config);
    panel.webview.options = createWebviewOptions(config);

    this._panel = panel;
    this._data = new WelcomePageDataManager(panel.webview, context);
    this._dispatcher = new WelcomeScreenDispatcher(this._data, panel);

    this._disposables = [
      this._dispatcher,
      panel.onDidDispose(this.dispose.bind(this))
    ];
  }

  public dispose() {
    WelcomePageController.instance = undefined;
    this._disposables.forEach((d) => void d.dispose());
    this._disposables.length = 0;
  }

  public static render(context: Context) {
    if (!WelcomePageController.instance) {
      WelcomePageController.instance = new WelcomePageController(
        context,
        vscode.window.createWebviewPanel(
          consts.WEBVIEW_PANEL_VIEW_TYPE,
          texts.WelcomePage.tabText,
          consts.WEBVIEW_PANEL_COLUMN
        )
      );
    }

    WelcomePageController.instance._panel.reveal(consts.WEBVIEW_PANEL_COLUMN);
  }
}

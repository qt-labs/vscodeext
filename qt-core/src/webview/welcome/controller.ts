// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { telemetry, DisposableStore } from 'qt-lib';
import { basicWebviewAppConfig, configWebviewPanel } from '@/webview/utils';
import * as texts from '@/texts';
import { WelcomePageDispatcher as WelcomeScreenDispatcher } from './dispatcher';
import { WelcomePageDataManager } from './data-manager';
import {
  isWalkthroughAvailable,
  isGetStartedDone,
  openWalkthrough
} from './walkthrough';
import * as consts from './constants';
import { createLogger } from 'qt-lib';

type Panel = vscode.WebviewPanel;
type Context = vscode.ExtensionContext;

const logger = createLogger('welcome-controller');

export function registerOpenWelcomePageCommand(context: Context) {
  const name = 'openWelcomePage';
  const cmd = `${consts.EXTENSION_ID}.${name}`;

  return vscode.commands.registerCommand(cmd, () => {
    telemetry.sendAction(name);
    WelcomePageController.render(context);
  });
}

export async function tryOpenWelcomePage(context: Context) {
  // While the qt-sm "Get Started" walkthrough is available but not yet
  // completed, guide the user through it instead of the welcome page.
  if (isWalkthroughAvailable() && !isGetStartedDone()) {
    logger.info('Opening the qt-sm walkthrough; get started not done yet');
    await openWalkthrough();
    return;
  }

  const key = consts.CONFIG_KEY_SHOW_ON_ACTIVATION;
  const config = vscode.workspace.getConfiguration(consts.EXTENSION_ID);

  if (config.get<boolean>(key) ?? true) {
    WelcomePageController.render(context);
  }
}

export function registerWelcomePageSerializer(context: Context) {
  return vscode.window.registerWebviewPanelSerializer(
    consts.WEBVIEW_PANEL_VIEW_TYPE,
    {
      async deserializeWebviewPanel(panel: Panel) {
        WelcomePageController.restore(context, panel);
        return Promise.resolve();
      }
    }
  );
}

export class WelcomePageController {
  public static instance: WelcomePageController | undefined;

  private readonly _panel: Panel;
  private readonly _data: WelcomePageDataManager;
  private readonly _dispatcher: WelcomeScreenDispatcher;
  private readonly _disposables = new DisposableStore();

  private constructor(context: Context, panel: Panel) {
    configWebviewPanel(panel, {
      appId: 'welcome',
      title: texts.WelcomePage.tabText,
      context,
      additionalResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, 'res', 'icons')
      ],
      ...basicWebviewAppConfig
    });

    this._panel = panel;
    this._data = new WelcomePageDataManager(panel.webview, context);
    this._dispatcher = new WelcomeScreenDispatcher(this._data, panel);

    this._disposables.push(
      this._dispatcher,
      panel.onDidDispose(this.dispose.bind(this))
    );
  }

  public dispose() {
    WelcomePageController.instance = undefined;
    this._disposables.dispose();
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

  public static restore(context: Context, panel: Panel) {
    if (WelcomePageController.instance) {
      panel.dispose();
      return;
    }

    WelcomePageController.instance = new WelcomePageController(context, panel);
  }
}

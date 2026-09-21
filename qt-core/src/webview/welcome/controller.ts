// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { telemetry, DisposableStore } from 'qt-lib';
import { WebAppId } from '@/webview/shared/types';
import { setupWebApp, createPanel } from '@/webview/utils';
import { WelcomePageDispatcher } from './dispatcher';
import { WelcomePageDataManager } from './data-manager';
import {
  isWalkthroughAvailable,
  isGetStartedDone,
  openWalkthrough
} from './walkthrough';
import * as consts from './constants';
import { createWrappedLogger } from 'qt-lib';

type Panel = vscode.WebviewPanel;
type Context = vscode.ExtensionContext;

let instance: WelcomePageController | undefined;

const appId: WebAppId = 'welcome';
const logger = createWrappedLogger(`${appId}-controller`);

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
    logger
      .text('Opening the qt-sm walkthrough; get started not done yet')
      .data('isWalkthroughAvailable', isWalkthroughAvailable())
      .data('isGetStartedDone', isGetStartedDone())
      .info();

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
  private readonly _data: WelcomePageDataManager;
  private readonly _dispatcher: WelcomePageDispatcher;
  private readonly _disposables = new DisposableStore();

  private constructor(
    context: Context,
    private readonly _panel: Panel
  ) {
    setupWebApp(appId, context, this._panel);

    this._data = new WelcomePageDataManager(this._panel.webview, context);
    this._dispatcher = new WelcomePageDispatcher(this._data, this._panel);
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
    instance ??= new WelcomePageController(context, createPanel(appId));
    instance._panel.reveal(consts.WEBVIEW_PANEL_COLUMN);
  }

  public static restore(context: Context, panel: Panel) {
    if (instance) {
      panel.dispose();
      return;
    }

    instance = new WelcomePageController(context, panel);
  }
}

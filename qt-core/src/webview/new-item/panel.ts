// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { telemetry } from 'qt-lib';
import { getNewFileBaseDir, getNewProjectBaseDir } from '@/qtcli/commands';
import { WebviewChannel } from '@/webview/channel';
import { NewItemDispatcher } from './dispatcher';
import * as texts from '@/texts';
import {
  createWebviewHtml,
  createWebviewOptions,
  basicWebviewAppConfig
} from '@/webview/utils';
import { EXTENSION_ID } from '@/constants';
import { startQtcliServer } from '@/qtcli/runner';
import { GlobalStateManager } from '@/state';

// definitions for webview-panel
const PanelColumn = vscode.ViewColumn.One;
const PanelViewType = 'ViewTypeWizard';

export function registerCreateNewItemPanelCommand(
  context: vscode.ExtensionContext
) {
  return vscode.commands.registerCommand(
    `${EXTENSION_ID}.createNewItem`,
    () => {
      telemetry.sendAction('createNewItem');
      NewItemPanel.render(context);
    }
  );
}
export class NewItemPanel {
  public static instance: NewItemPanel | undefined;
  private readonly _comm: WebviewChannel;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _disposables: vscode.Disposable[] = [];
  private readonly _dispatcher = new NewItemDispatcher();

  private constructor(
    panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext
  ) {
    const config = {
      app: 'new-item',
      title: texts.newItem.tabText,
      context,
      ...basicWebviewAppConfig
    };

    panel.webview.html = createWebviewHtml(panel.webview, config);
    panel.webview.options = createWebviewOptions(config);

    this._comm = new WebviewChannel(panel.webview);
    this._panel = panel;
    this._dispatcher.setPanel(this);
    this._dispatcher.setComm(this._comm);
    this._dispatcher.setContext(context);

    this._disposables = [
      panel.onDidDispose(this.dispose.bind(this)),
      this._comm,
      this._comm.onDidReceiveMessage((m) => {
        this._dispatcher.dispatch(m);
      })
    ];
  }

  public dispose() {
    NewItemPanel.instance = undefined;
    this._dispatcher.dispose();

    while (this._disposables.length) {
      const item = this._disposables.pop();
      if (item) {
        item.dispose();
      }
    }
  }

  public close() {
    this._panel.dispose();
  }

  public static render(context: vscode.ExtensionContext) {
    if (!NewItemPanel.instance) {
      const panel = vscode.window.createWebviewPanel(
        PanelViewType,
        texts.newItem.tabText,
        PanelColumn
      );

      NewItemPanel.instance = new NewItemPanel(panel, context);
    }

    void startQtcliServer(context.extensionUri);

    const globalState = new GlobalStateManager(context);
    const savedOpenIn = globalState.getNewProjectOpenIn();

    NewItemPanel.instance._dispatcher.setUiConfigs({
      newFileBaseDir: getNewFileBaseDir(),
      newProjectBaseDir: getNewProjectBaseDir(),
      openIn: savedOpenIn
    });
    NewItemPanel.instance._panel.reveal(PanelColumn);
  }
}

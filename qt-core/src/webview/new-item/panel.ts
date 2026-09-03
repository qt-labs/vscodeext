// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { telemetry, DisposableStore } from 'qt-lib';
import { getNewFileBaseDir, getNewProjectBaseDir } from '@/qtcli/commands';
import { NewItemDispatcher } from './dispatcher';
import * as texts from '@/texts';
import { basicWebviewAppConfig, configWebviewPanel } from '@/webview/utils';
import { EXTENSION_ID } from '@/constants';
import { QtcliRestServer, generateSocketId } from '@/qtcli/rest';
import { GlobalStateManager } from '@/state';

// definitions for webview-panel
const PanelColumn = vscode.ViewColumn.One;
const PanelViewType = 'ViewTypeWizard';

export function registerCreateNewItemPanelCommand(
  context: vscode.ExtensionContext
) {
  return vscode.commands.registerCommand(
    `${EXTENSION_ID}.createNewItem`,
    async () => {
      telemetry.sendAction('createNewItem');
      await NewItemPanel.render(context);
    }
  );
}
export class NewItemPanel {
  public static instance: NewItemPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _disposables = new DisposableStore();
  private readonly _dispatcher: NewItemDispatcher;

  private constructor(
    panel: vscode.WebviewPanel,
    qtcliSocketName: string,
    context: vscode.ExtensionContext
  ) {
    configWebviewPanel(panel, {
      appId: 'new-item',
      title: texts.newItem.tabText,
      context,
      ...basicWebviewAppConfig
    });

    this._panel = panel;
    this._dispatcher = new NewItemDispatcher(qtcliSocketName, panel, context);
    this._disposables.push(panel.onDidDispose(this.dispose.bind(this)));
  }

  public dispose() {
    NewItemPanel.instance = undefined;
    this._dispatcher.dispose();
  }

  public static async render(context: vscode.ExtensionContext) {
    if (!NewItemPanel.instance) {
      const panel = vscode.window.createWebviewPanel(
        PanelViewType,
        texts.newItem.tabText,
        PanelColumn
      );

      const socketId = generateSocketId('new-item');
      const qtcliServer = new QtcliRestServer(socketId);
      await qtcliServer.start(context);

      NewItemPanel.instance = new NewItemPanel(
        panel,
        qtcliServer.socketName,
        context
      );
    }

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

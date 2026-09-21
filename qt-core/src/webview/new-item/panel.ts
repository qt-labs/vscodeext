// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { telemetry, DisposableStore } from 'qt-lib';
import { getNewFileBaseDir, getNewProjectBaseDir } from '@/qtcli/commands';
import { WebAppId } from '@/webview/shared/types';
import { setupWebApp, createPanel } from '@/webview/utils';
import { NewItemDispatcher } from './dispatcher';
import { EXTENSION_ID } from '@/constants';
import { QtcliRestServer, generateSocketId } from '@/qtcli/rest';
import { GlobalStateManager } from '@/state';

const appId: WebAppId = 'new-item';
let instance: NewItemPanel | undefined;

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
  private readonly _dispatcher: NewItemDispatcher;
  private readonly _disposables = new DisposableStore();

  private constructor(
    private readonly _panel: vscode.WebviewPanel,
    qtcliSocketName: string,
    context: vscode.ExtensionContext
  ) {
    setupWebApp(appId, context, this._panel);
    this._dispatcher = new NewItemDispatcher(
      qtcliSocketName,
      this._panel,
      context
    );
    this._disposables.push(this._panel.onDidDispose(this.dispose.bind(this)));
  }

  public dispose() {
    instance = undefined;
    this._dispatcher.dispose();
  }

  public static async render(context: vscode.ExtensionContext) {
    if (!instance) {
      const panel = createPanel(appId);
      const socketId = generateSocketId('new-item');
      const qtcliServer = new QtcliRestServer(socketId);
      await qtcliServer.start(context);

      instance = new NewItemPanel(panel, qtcliServer.socketName, context);
    }

    const globalState = new GlobalStateManager(context);
    const savedOpenIn = globalState.getNewProjectOpenIn();

    instance._dispatcher.setUiConfigs({
      newFileBaseDir: getNewFileBaseDir(),
      newProjectBaseDir: getNewProjectBaseDir(),
      openIn: savedOpenIn
    });
    instance._panel.reveal();
  }
}

// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { createLogger } from 'qt-lib';
import { QtcliRunner } from '@/qtcli/runner';
import { QtcliAction } from '@/qtcli/common';
import {
  findQtcliExePath,
  getNewFileBaseDir,
  getNewProjectBaseDir
} from '@/qtcli/commands';
import { getUri, getNonce } from './utils';
import { CommandId } from '@/webview/shared/message';
import { NewItemCommandHandler } from './new-item-handlers';
import * as texts from '@/texts';

const logger = createLogger('new-item-panel');
let qtcliRunner: QtcliRunner | undefined = undefined;

// definitions for webview-panel
const PanelColumn = vscode.ViewColumn.One;
const PanelViewType = 'ViewTypeWizard';

// defintions for webview-ui
const UiRootDir = 'webview-ui/dist/';
const UiJsFile = 'index.js';
const UiCssFile = 'index.css';

export class NewItemPanel {
  public static instance: NewItemPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _disposables: vscode.Disposable[] = [];
  private readonly _cmdHandler = new NewItemCommandHandler();

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    panel.webview.html = createWebviewContent(panel.webview, extensionUri);
    this._disposables = [
      panel.onDidDispose(this.dispose.bind(this)),
      panel.webview.onDidReceiveMessage((m) => {
        this._cmdHandler.dispatch(m);
      })
    ];

    this._panel = panel;
    this._cmdHandler.setPanel(this);
  }

  public dispose() {
    NewItemPanel.instance = undefined;
    this._cmdHandler.dispose();

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

  public static render(extensionUri: vscode.Uri) {
    if (!NewItemPanel.instance) {
      const p = createWebviewPanel(extensionUri);
      NewItemPanel.instance = new NewItemPanel(p, extensionUri);
    }

    void startQtcliServer(extensionUri);

    NewItemPanel.instance._panel.reveal(PanelColumn);
    NewItemPanel.instance.post(CommandId.PanelRevealed, createInitData());
  }

  public post(
    id: CommandId,
    payload: unknown,
    tag: string | undefined = undefined
  ) {
    void this._panel.webview.postMessage({ id, payload, tag });
  }
}

// helpers
function createInitData() {
  return {
    newFileBaseDir: getNewFileBaseDir(),
    newProjectBaseDir: getNewProjectBaseDir()
  };
}

function createWebviewPanel(extensionUri: vscode.Uri): vscode.WebviewPanel {
  const option = {
    enableScripts: true,
    localResourceRoots: [vscode.Uri.joinPath(extensionUri, UiRootDir)]
  };

  return vscode.window.createWebviewPanel(
    PanelViewType,
    texts.newItem.tabText,
    PanelColumn,
    option
  );
}

function createWebviewContent(webview: vscode.Webview, baseUri: vscode.Uri) {
  const root = UiRootDir.split('/');
  const js = getUri(webview, baseUri, [...root, UiJsFile]);
  const css = getUri(webview, baseUri, [...root, UiCssFile]);
  const nonce = getNonce();

  return /*html*/ `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <title>Wizard</title>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="stylesheet" type="text/css" href="${css.toString()}">
        <script defer nonce="${nonce}" src="${js.toString()}"></script>
      </head>
      <body>
        <div id="app"></div>
      </body>
    </html>
  `;
}

async function startQtcliServer(extensionUri: vscode.Uri) {
  if (!qtcliRunner) {
    const exePath = await findQtcliExePath(extensionUri);
    if (exePath) {
      qtcliRunner = new QtcliRunner();
      qtcliRunner.setQtcliExePath(exePath);
    } else {
      logger.error('cannot find qtcli executable');
      return;
    }
  }

  qtcliRunner.run(QtcliAction.ServerControl, 'start');
}

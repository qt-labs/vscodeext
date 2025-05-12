// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { getUri, getNonce } from './utils';
import { PushMessageId, PushMessage, isPushMessage } from './shared/message';

// definitions for webview-panel
const PanelTitle = 'New Item';
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

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    panel.onDidDispose(
      () => {
        this.dispose();
      },
      null,
      this._disposables
    );

    panel.webview.html = createWebviewContent(panel.webview, extensionUri);
    panel.webview.onDidReceiveMessage((m: unknown) => {
      if (isPushMessage(m)) {
        this._onDidReceivePushMessage(m);
      }
    });

    this._panel = panel;
  }

  public dispose() {
    NewItemPanel.instance = undefined;
    this._panel.dispose();

    while (this._disposables.length) {
      const item = this._disposables.pop();
      if (item) {
        item.dispose();
      }
    }
  }

  public static render(extensionUri: vscode.Uri) {
    if (!NewItemPanel.instance) {
      const p = createWebviewPanel(extensionUri);
      NewItemPanel.instance = new NewItemPanel(p, extensionUri);
    }

    NewItemPanel.instance._panel.reveal(PanelColumn);
    NewItemPanel.instance._push(PushMessageId.PanelInit, {});
  }

  private _push(id: PushMessageId, data: unknown) {
    const p: PushMessage = { id, data };
    void this._panel.webview.postMessage(p);
  }

  private _onDidReceivePushMessage(p: PushMessage) {
    if (p.id === PushMessageId.UiClosed) {
      this.dispose();
      return;
    }
  }
}

// helpers
function createWebviewPanel(extensionUri: vscode.Uri): vscode.WebviewPanel {
  const option = {
    enableScripts: true,
    localResourceRoots: [vscode.Uri.joinPath(extensionUri, UiRootDir)]
  };

  return vscode.window.createWebviewPanel(
    PanelViewType,
    PanelTitle,
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

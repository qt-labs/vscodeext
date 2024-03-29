// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import { getNonce, getUri } from '../util';
import { designerServer } from '../../designer-server';
import { designerClient } from '../../designer-client';

export class UIEditorProvider implements vscode.CustomTextEditorProvider {
  constructor(private readonly context: vscode.ExtensionContext) {}

  private static readonly viewType = 'qt.uiEditor';
  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new UIEditorProvider(context);
    const providerRegistration = vscode.window.registerCustomEditorProvider(
      UIEditorProvider.viewType,
      provider
    );
    return providerRegistration;
  }
  public resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    void _token;
    webviewPanel.webview.options = {
      enableScripts: true
    };
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);
    function updateWebview() {
      void webviewPanel.webview.postMessage({
        type: 'update',
        text: document.getText()
      });
    }
    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(
      (e) => {
        if (e.document.uri.toString() === document.uri.toString()) {
          updateWebview();
        }
      }
    );

    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
    });

    webviewPanel.webview.onDidReceiveMessage(async (e: { type: string }) => {
      switch (e.type) {
        case 'run':
          if (!designerClient.isRunning()) {
            await designerClient.start();
          }
          // wait for the client to connect
          while (!designerServer.isClientConnected()) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
          designerServer.sendFile(document.uri.fsPath);
          break;
        default:
          throw new Error('Unknown message type');
      }
    });

    updateWebview();
    return Promise.resolve();
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    // Use a nonce to whitelist which scripts can be run
    const nonce = getNonce();
    const scriptUri = getUri(webview, this.context.extensionUri, [
      'out',
      'editors',
      'ui',
      'webview-ui',
      'main.js'
    ]);

    // prettier-ignore
    const html =
    `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Open this file with Qt Designer</title>
      <style>
        body {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          margin: 0;
        }
    </style>
    </head>
    <body>
      <div>
        <vscode-button id="openWithDesignerButton" tabindex="0">Open this file with Qt Designer</vscode-button>
      </div>
      <script type="module" nonce="${nonce}" src="${scriptUri.toString()}"></script>
    </body>
    </html>`;
    return html;
  }
}

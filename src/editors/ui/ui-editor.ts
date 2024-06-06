// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { getNonce, getUri } from '@/editors/util';
import { projectManager } from '@/extension';
import { createLogger } from '@/logger';
import { checkSelectedKitandAskForKitSelection } from '@cmd/register-qt-path';

const logger = createLogger('ui-editor');

export class UIEditorProvider implements vscode.CustomTextEditorProvider {
  constructor(private readonly context: vscode.ExtensionContext) {}

  private static readonly viewType = 'qt-official.uiEditor';
  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new UIEditorProvider(context);
    const providerRegistration = vscode.window.registerCustomEditorProvider(
      UIEditorProvider.viewType,
      provider
    );
    return providerRegistration;
  }
  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    void _token;
    webviewPanel.webview.options = {
      enableScripts: true
    };
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);
    const delay = async (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));
    webviewPanel.webview.onDidReceiveMessage(async (e: { type: string }) => {
      const project = projectManager.findProjectContainingFile(document.uri);
      if (project === undefined) {
        logger.error('Project not found');
        throw new Error('Project not found');
      }
      const designerServer = project.designerServer;
      const designerClient = project.designerClient;

      switch (e.type) {
        case 'run':
          if (designerClient === undefined) {
            // User may not have selected the kit.
            // We can check and ask for kit selection.
            await checkSelectedKitandAskForKitSelection();
            logger.error('Designer client not found');
            throw new Error('Designer client not found');
          }
          if (!designerClient.isRunning()) {
            logger.info('Starting designer client');
            designerServer.closeClient();
            designerClient.start(designerServer.getPort());
          }
          // wait for the client to connect
          while (!designerServer.isClientConnected()) {
            await delay(100);
          }
          designerServer.sendFile(document.uri.fsPath);
          logger.info('File sent to designer server: ' + document.uri.fsPath);
          break;
        default:
          logger.error('Unknown message type');
          throw new Error('Unknown message type');
      }
    });
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
      <title>Open this file with Qt Widgets Designer</title>
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
        <vscode-button id="openWithDesignerButton" tabindex="0">Open this file with Qt Widgets Designer</vscode-button>
      </div>
      <script type="module" nonce="${nonce}" src="${scriptUri.toString()}"></script>
    </body>
    </html>`;
    return html;
  }
}

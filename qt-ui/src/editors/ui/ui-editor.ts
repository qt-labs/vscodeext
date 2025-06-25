// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import {
  askForKitSelection,
  createLogger,
  QtWorkspaceType,
  telemetry
} from 'qt-lib';
import { getNonce, getUri } from '@/editors/util';
import { projectManager } from '@/extension';
import { delay } from '@/util';
import { EXTENSION_ID } from '@/constants';

const logger = createLogger('ui-editor');

export class UIEditorProvider implements vscode.CustomTextEditorProvider {
  constructor(private readonly context: vscode.ExtensionContext) {}

  private static readonly viewType = `${EXTENSION_ID}.uiEditor`;
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
    webviewPanel.webview.onDidReceiveMessage(async (e: { type: string }) => {
      switch (e.type) {
        case 'run': {
          const project = projectManager.findProjectContainingFile(
            document.uri
          );
          if (project === undefined) {
            const err = `Project not found for file: ${document.uri.toString()}`;
            logger.error(err);
            return;
          }
          const designerServer = project.designerServer;
          const designerClient = project.designerClient;
          if (designerClient === undefined) {
            // User may not have selected the kit.
            // We can check and ask for kit selection.
            if (project.workspaceType === QtWorkspaceType.CMakeExt) {
              askForKitSelection();
            }
            logger.error('Designer client not found');
            return;
          }
          if (!designerClient.isRunning()) {
            logger.info(`Starting designer client:${designerClient.exe}`);
            designerServer.closeClient();
            designerClient.start(designerServer.getPort());
          }
          // wait for the client to connect
          while (!designerServer.isClientConnected()) {
            await delay(100);
          }
          telemetry.sendAction('openWithDesigner');
          designerServer.sendFile(document.uri.fsPath);
          logger.info('File sent to designer server: ' + document.uri.fsPath);
          break;
        }
        case 'openWithTextEditor': {
          void UIEditorProvider.openWithTextEditor(document);
          break;
        }
        default:
          logger.error('Unknown message type');
          return;
      }
    });
    return Promise.resolve();
  }
  private static async openWithTextEditor(
    document: vscode.TextDocument
  ): Promise<void> {
    // Reveal the file in the current editor tab instead of opening a new one
    await vscode.commands.executeCommand(
      'workbench.action.revertAndCloseActiveEditor'
    );
    await vscode.commands.executeCommand(
      'vscode.openWith',
      document.uri,
      'default',
      {
        preview: false,
        preserveFocus: false
      }
    );
    telemetry.sendAction('openWithTextEditor');
    logger.info(
      'File opened with text editor in current tab: ' + document.uri.fsPath
    );
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
        <vscode-button id="openWithTextEditorButton" tabindex="0" style="margin-left: 12px;">Open this file with Text Editor</vscode-button>
      </div>
      <script type="module" nonce="${nonce}" src="${scriptUri.toString()}"></script>
    </body>
    </html>`;
    return html;
  }
}

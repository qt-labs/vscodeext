// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import type { LicenseAgreement } from 'sms-api';

interface MessageToWebview {
  type: 'init';
  payload: {
    agreements: LicenseAgreement[];
  };
}

interface MessageToExtension {
  type: 'accept' | 'cancel';
}

/**
 * Opens a webview panel as a full-tab modal showing all license agreements.
 * Resolves `true` when user clicks "Agree & Continue", `false` on "Cancel"
 * or panel close.
 */
export async function showLicenseAgreementPanel(
  context: vscode.ExtensionContext,
  agreements: LicenseAgreement[]
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let resolved = false;

    const panel = vscode.window.createWebviewPanel(
      'qt-sms.licenseAgreement',
      'License Agreement',
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: false,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'webview-ui', 'dist')
        ]
      }
    );

    panel.webview.html = getWebviewHtml(panel.webview, context);

    // Send license data once the webview is ready
    // The webview will receive this when the message listener is set up.
    // A small delay ensures the Svelte app has mounted.
    setTimeout(() => {
      const msg: MessageToWebview = {
        type: 'init',
        payload: { agreements }
      };
      void panel.webview.postMessage(msg);
    }, 100);

    panel.webview.onDidReceiveMessage(
      (msg: MessageToExtension) => {
        if (resolved) {
          return;
        }

        if (msg.type === 'accept') {
          resolved = true;
          resolve(true);
          // Close after a brief delay so the user sees the action registered
          setTimeout(() => {
            panel.dispose();
          }, 1000);
        } else {
          resolved = true;
          resolve(false);
          panel.dispose();
        }
      },
      undefined,
      []
    );

    panel.onDidDispose(() => {
      if (!resolved) {
        resolved = true;
        resolve(false);
      }
    });
  });
}

function getWebviewHtml(
  webview: vscode.Webview,
  context: vscode.ExtensionContext
): string {
  const distUri = vscode.Uri.joinPath(
    context.extensionUri,
    'webview-ui',
    'dist'
  );
  const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(distUri, 'index.js'));
  const cssUri = webview.asWebviewUri(
    vscode.Uri.joinPath(distUri, 'index.css')
  );

  const nonce = getNonce();

  return /*html*/ `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta
          http-equiv="Content-Security-Policy"
          content="default-src 'none';
                   style-src ${webview.cspSource} 'unsafe-inline';
                   script-src 'nonce-${nonce}';
                   img-src ${webview.cspSource} https: data:;"
        />
        <link rel="stylesheet" type="text/css" href="${cssUri.toString()}" />
        <title>License Agreements</title>
      </head>
      <body>
        <div id="app"></div>
        <script defer nonce="${nonce}" src="${jsUri.toString()}"></script>
      </body>
    </html>
  `;
}

function getNonce(): string {
  let text = '';
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

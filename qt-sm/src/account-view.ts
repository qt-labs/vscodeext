// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { EXTENSION_ID } from '@/constants';

/**
 * The Qt Account section in the side panel. A webview view (not a
 * viewsWelcome contribution) because the design centers the "or" separator
 * between buttons, which welcome views cannot express — they trim each line
 * and render text left-aligned. The styling below mirrors the native welcome
 * view (20px side padding, full-width buttons capped at 300px) so it matches
 * the Get Started section above it.
 */
export class AccountViewProvider implements vscode.WebviewViewProvider {
  private _view: vscode.WebviewView | undefined;
  private _session: vscode.AuthenticationSession | undefined;

  setSession(session: vscode.AuthenticationSession | undefined): void {
    this._session = session;
    this.render();
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this._view = view;
    view.webview.options = { enableScripts: true };
    view.webview.onDidReceiveMessage((msg: { command?: string }) => {
      if (msg.command) {
        void vscode.commands.executeCommand(msg.command);
      }
    });
    this.render();
  }

  private render(): void {
    if (!this._view) {
      return;
    }
    this._view.description = this._session?.account.label ?? '';
    this._view.webview.html = getHtml(!!this._session);
  }
}

export function registerAccountView(
  context: vscode.ExtensionContext
): AccountViewProvider {
  const provider = new AccountViewProvider();
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      `${EXTENSION_ID}.accountView`,
      provider
    )
  );
  return provider;
}

function getHtml(loggedIn: boolean): string {
  const body = loggedIn
    ? /*html*/ `
        <p>Signed in to your Qt Account.</p>
        <button data-command="${EXTENSION_ID}.logout">Sign Out</button>
      `
    : /*html*/ `
        <p>Sign in to your Qt Account to manage packages.</p>
        <button data-command="${EXTENSION_ID}.login">Sign In</button>
        <button class="secondary" data-command="${EXTENSION_ID}.resetPassword">
          Forgot Password
        </button>
        <p class="or">or</p>
        <button data-command="${EXTENSION_ID}.createAccount">
          Create Account
        </button>
      `;

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
                   style-src 'unsafe-inline';
                   script-src 'nonce-${nonce}';"
        />
        <style>
          body {
            display: flex;
            flex-direction: column;
            align-items: center;
            box-sizing: border-box;
            margin: 0;
            padding: 0 20px 1em;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
          }

          body > * {
            margin: 1em 0 0;
          }

          p {
            width: 100%;
            line-height: 1.4;
          }

          .or {
            text-align: center;
          }

          button {
            box-sizing: border-box;
            display: flex;
            justify-content: center;
            align-items: center;
            width: 100%;
            max-width: 300px;
            padding: 4px;
            border-radius: 2px;
            border: 1px solid var(--vscode-button-border, transparent);
            line-height: 18px;
            cursor: pointer;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            font-family: inherit;
            font-size: inherit;
          }

          button:hover {
            background: var(--vscode-button-hoverBackground);
          }

          button:focus-visible {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: 2px;
          }

          button.secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
          }

          button.secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
          }
        </style>
      </head>
      <body>
        ${body}
        <script nonce="${nonce}">
          const vscodeApi = acquireVsCodeApi();
          for (const btn of document.querySelectorAll('button[data-command]')) {
            btn.addEventListener('click', () =>
              vscodeApi.postMessage({ command: btn.dataset.command })
            );
          }
        </script>
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

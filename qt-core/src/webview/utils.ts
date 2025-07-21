// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import * as dotenv from 'dotenv';
import {
  Uri,
  Webview,
  ExtensionMode as Mode,
  ExtensionContext as Context
} from 'vscode';

export interface WebviewAppConfig {
  app: string;
  title: string;
  srcDir: string;
  distDir: string;
  jsFile: string;
  cssFile: string;
  context: Context;
}

export const basicWebviewAppConfig = {
  srcDir: 'webview-ui',
  distDir: 'webview-ui/dist',
  jsFile: 'index.js',
  cssFile: 'index.css'
};

export function createWebviewHtml(view: Webview, config: WebviewAppConfig) {
  const root = config.distDir.split('/');
  const baseUri = config.context.extensionUri;
  const js = getUri(view, baseUri, [...root, config.jsFile]);
  const css = getUri(view, baseUri, [...root, config.cssFile]);

  let html = `
    <link rel="stylesheet" type="text/css" href="${css.toString()}">
    <script defer nonce="${getNonce()}" src="${js.toString()}"></script>
    `;

  if (config.context.extensionMode === Mode.Development) {
    const dotenvFile = path.resolve(__dirname, `../${config.srcDir}/.env`);
    dotenv.config({ path: dotenvFile });

    const devPort = process.env.VITE_DEV_PORT ?? '5173';
    const devHost = `localhost:${devPort}`;
    const devModuleUri = `http://${devHost}/src/apps/main.ts`;

    html = `
      <meta http-equiv="Content-Security-Policy" content="
          default-src 'none';
          img-src https: data: blob:;
          style-src 'unsafe-inline' http://${devHost};
          script-src http://${devHost} 'unsafe-eval';
          connect-src ws://${devHost} http://${devHost};
        ">
      <script type="module" src="${devModuleUri}"></script>
      `;
  }

  return /*html*/ `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <title>${config.title}</title>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        ${html}
      </head>
      <body data-app=${config.app}>
        <div id="app"></div>
      </body>
    </html>
  `;
}

export function createWebviewOptions(config: WebviewAppConfig) {
  return {
    enableScripts: true,
    retainContextWhenHidden: true,
    localResourceRoots: [
      Uri.joinPath(config.context.extensionUri, config.distDir)
    ]
  };
}

function getUri(webview: Webview, baseUri: Uri, pathList: string[]) {
  return webview.asWebviewUri(Uri.joinPath(baseUri, ...pathList));
}

function getNonce() {
  let text = '';
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

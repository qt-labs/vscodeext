// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import * as dotenv from 'dotenv';
import {
  window,
  Uri,
  Webview as View,
  WebviewPanel as Panel,
  ExtensionMode as Mode,
  ExtensionContext as Context
} from 'vscode';

import { getWebAppInfo } from './info';
import { type WebAppId } from './shared/types';

const WebAppDirs = {
  src: 'webview-ui',
  dist: 'webview-ui/dist'
};

export function createPanel(id: WebAppId) {
  const info = getWebAppInfo(id);
  return window.createWebviewPanel(info.viewType, info.title, info.viewColumn);
}

export function setupWebApp(id: WebAppId, context: Context, panel: Panel) {
  const info = getWebAppInfo(id);
  const baseUri = context.extensionUri;

  panel.webview.html = createHtml(id, context, panel);
  panel.webview.options = {
    enableScripts: true,
    localResourceRoots: [
      Uri.joinPath(baseUri, WebAppDirs.dist),
      Uri.joinPath(baseUri, 'res', 'icons')
    ]
  };

  panel.iconPath = {
    dark: Uri.joinPath(baseUri, info.iconPathPrefix + '-dark.svg'),
    light: Uri.joinPath(baseUri, info.iconPathPrefix + '-light.svg')
  };
}

export function exposeDirs(panel: Panel, dirs: Uri[]) {
  const view = panel.webview;
  const options = view.options;

  view.options = {
    ...options,
    localResourceRoots: [...(options.localResourceRoots ?? []), ...dirs]
  };
}

function createHtml(id: WebAppId, context: Context, panel: Panel) {
  const meta = getWebAppInfo(id);
  const extraHeaders =
    context.extensionMode === Mode.Development
      ? createDevHeaders()
      : createProductionHeaders(panel.webview, context.extensionUri);

  return /*html*/ `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <title>${meta.title}</title>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        ${extraHeaders}
      </head>
      <body data-app-id=${meta.appId}>
        <div id="app"></div>
      </body>
    </html>
  `;
}

function createDevHeaders() {
  dotenv.config({
    path: path.resolve(__dirname, `../${WebAppDirs.src}/.env`)
  });

  const port = process.env.VITE_DEV_PORT ?? '5173';
  const host = `localhost:${port}`;
  const moduleUri = `http://${host}/src/apps/main.ts`;

  return `
    <meta http-equiv="Content-Security-Policy" content="
        default-src 'none';
        img-src https: data: blob:;
        style-src 'unsafe-inline' http://${host};
        script-src http://${host} 'unsafe-eval';
        connect-src ws://${host} http://${host};
      ">
    <script type="module" src="${moduleUri}"></script>
  `;
}

function createProductionHeaders(view: View, baseUri: Uri) {
  const distDirs = WebAppDirs.dist.split('/');
  const js = getUri(view, baseUri, [...distDirs, 'index.js']);
  const css = getUri(view, baseUri, [...distDirs, 'index.css']);

  return `
    <link rel="stylesheet" type="text/css" href="${css.toString()}">
    <script defer nonce="${getNonce()}" src="${js.toString()}"></script>
  `;
}

function getUri(webview: View, baseUri: Uri, pathList: string[]) {
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

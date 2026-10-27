// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { commands, Uri, ViewColumn, ExtensionContext as Context } from 'vscode';

import { telemetry, DisposableStore } from 'qt-lib';
import { createPanel } from '@/webview/utils';
import { OpenOptions } from '@/webview/shared/doc-viewer';
import { docViewerInfra as infra } from './infra';
import { DocViewerSession } from './session';
import * as consts from './constants';

const openCmd = 'openDocViewer';
const openCmdFull = `${consts.EXTENSION_ID}.${openCmd}`;

let controller: DocViewerController | undefined;

export function addDocViewer(context: Context) {
  controller = new DocViewerController();

  void infra.server.start();
  void infra.history.init(context.globalStorageUri, 'history.json');
  void infra.bookmarks.init(context.globalStorageUri, 'bookmarks.json');

  context.subscriptions.push(
    commands.registerCommand(openCmdFull, (uri?: Uri, o?: OpenOptions) => {
      telemetry.sendAction(openCmd);
      controller?.open(context, uri, o);
    })
  );
}

export async function openDocViewer(uri: Uri, o: OpenOptions) {
  await commands.executeCommand(openCmdFull, uri, o);
}

export class DocViewerController {
  private readonly _sessions = new Set<DocViewerSession>();
  private readonly _disposables = new DisposableStore();

  dispose() {
    this._disposables.dispose();
  }

  public open(context: Context, uri?: Uri, o?: OpenOptions) {
    const col =
      o?.origin === 'ex-browser'
        ? this._getLastActiveColumn(ViewColumn.Beside)
        : undefined;

    if (o?.forceNewWindow !== true) {
      const existing = uri && this._find(uri);
      if (existing) {
        existing.reveal(col);
        return;
      }
    }

    const openOptions: OpenOptions = {
      ...(o ?? { origin: 'unspecified' }),
      ...(uri && { homeUri: uri.toString() })
    };

    const s = this._add(context, openOptions);
    s.reveal(col);
  }

  private _add(context: Context, openOptions: OpenOptions) {
    const panel = createPanel(consts.AppId);
    const s = new DocViewerSession(context, panel, openOptions);

    this._disposables.push(
      panel.onDidChangeViewState((e) => {
        if (e.webviewPanel.active) {
          this._sessions.delete(s);
          this._sessions.add(s); // to track the last active one
        }
      }),

      panel.onDidDispose(() => {
        this._sessions.delete(s);
      })
    );

    this._sessions.add(s);
    return s;
  }

  private _find(uri: Uri) {
    for (const s of this._sessions) {
      if (s.currentUri.uri === uri.toString()) {
        return s;
      }
    }

    return undefined;
  }

  private _getLastActiveColumn(fallback: ViewColumn) {
    const s = [...this._sessions].at(-1);
    return s?.viewColumn ?? fallback;
  }
}

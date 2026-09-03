// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import _ from 'lodash';
import * as path from 'path';
import * as vscode from 'vscode';

import { getQtQmlApi, normalizeDriveLetter, DisposableStore } from 'qt-lib';
import { Command, CommandId } from '@/webview/shared/message';
import { WebviewDispatcher } from '@/webview/dispatcher';
import { QmlTraceCommandReply } from '@/webview/shared/qml-trace';
import { QmlTraceDoc } from './doc';
import * as texts from '@/texts';

export class QmlTraceController {
  private readonly _dispatcher: WebviewDispatcher;
  private readonly _disposables = new DisposableStore();

  public constructor(
    private readonly _doc: QmlTraceDoc,
    panel: vscode.WebviewPanel
  ) {
    this._dispatcher = new WebviewDispatcher('qml-trace', panel);
    this._dispatcher.setHandlers([
      [CommandId.QmlTraceGetConfigs, this._onGetConfigs],
      [CommandId.QmlTraceOpenFileInTextEditor, this._onOpenFileInTextEditor],
      [CommandId.QmlTraceOpenFileInTraceViewer, this._onOpenFileInTraceViewer],
      [CommandId.QmlTraceSetConfigs, this._onSetConfigs],
      [CommandId.QmlTraceSelectFolder, this._onSelectFolder],
      [CommandId.QmlTraceGetWorkspaceFolders, this._onGetWorkspaceFolders]
    ]);

    this._disposables.push(this._dispatcher);
  }

  public dispose() {
    this._disposables.dispose();
  }

  private readonly _onGetConfigs = async (cmd: Command) => {
    this._reply(cmd, {
      filePath: this._doc.uri.fsPath,
      fileName: path.basename(this._doc.uri.fsPath),
      additionalDirs: await this._doc.getAdditionalDirs()
    });
  };

  private readonly _onOpenFileInTextEditor = (cmd: Command) => {
    void vscode.window.showTextDocument(this._doc.uri);
    this._reply(cmd, { status: 'done' });
  };

  private readonly _onOpenFileInTraceViewer = async (cmd: Command) => {
    (await getQmlTraceApi()).open(this._doc.uri);
    this._reply(cmd, { status: 'done' });
  };

  private readonly _onSetConfigs = (cmd: Command) => {
    const dirs = _.get(cmd.payload, 'additionalDirs', [] as string[]);
    void this._doc.setAdditionalDirs(dirs);
    this._reply(cmd, { status: 'done' });
  };

  private readonly _onSelectFolder = async (cmd: Command) => {
    const options: vscode.OpenDialogOptions = {
      canSelectMany: false,
      canSelectFiles: false,
      canSelectFolders: true,
      openLabel: texts.qmlTrace.folderSelectTitle
    };

    const folderUri = await vscode.window.showOpenDialog(options);
    if (folderUri && folderUri.length > 0) {
      const folder = normalizeDriveLetter(folderUri[0]?.fsPath ?? '');
      this._reply(cmd, { folders: [folder] });
    }
  };

  private readonly _onGetWorkspaceFolders = (cmd: Command) => {
    const folders = (vscode.workspace.workspaceFolders ?? []).map((f) => {
      return f.uri.fsPath;
    });

    this._reply(cmd, { folders });
  };

  private _reply(cmd: Command, data: QmlTraceCommandReply) {
    this._dispatcher.channel.replyData(cmd, data);
  }
}

// helpers
async function getQmlTraceApi() {
  const api = await getQtQmlApi();
  if (!api) {
    throw Error('QtQmlAPI is not available');
  }

  return api.traceFile;
}

// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import _ from 'lodash';
import * as path from 'path';
import * as vscode from 'vscode';

import { createLogger, getQtQmlApi } from 'qt-lib';
import {
  Command,
  CommandId,
  CommandHandler,
  IsCommand
} from '@/webview/shared/message';
import { WebviewChannel } from '@/webview/channel';
import { QmlTraceCommandReply } from '@/webview/shared/qml-trace';
import { QmlTraceDoc } from './doc';
import * as texts from '@/texts';

const logger = createLogger('qml-trace-controller');

export class QmlTraceController {
  private readonly _comm: WebviewChannel;
  private readonly _routes: Map<CommandId, CommandHandler>;
  private readonly _disposables: vscode.Disposable[] = [];

  public constructor(
    private readonly _doc: QmlTraceDoc,
    private readonly _panel: vscode.WebviewPanel
  ) {
    this._comm = new WebviewChannel(this._panel.webview);
    this._disposables.push(
      this._comm,
      this._comm.onDidReceiveMessage(this._dispatch)
    );

    this._routes = new Map<CommandId, CommandHandler>([
      [CommandId.QmlTraceGetConfigs, this._onGetConfigs],
      [CommandId.QmlTraceOpenFileInTextEditor, this._onOpenFileInTextEditor],
      [CommandId.QmlTraceOpenFileInTraceViewer, this._onOpenFileInTraceViewer],
      [CommandId.QmlTraceSetConfigs, this._onSetConfigs],
      [CommandId.QmlTraceSelectFolder, this._onSelectFolder],
      [CommandId.QmlTraceGetWorkspaceFolders, this._onGetWorkspaceFolders]
    ]);
  }

  public dispose() {
    this._disposables.forEach((d) => {
      d.dispose();
    });
    this._disposables.length = 0;
  }

  private readonly _dispatch = async (cmd: unknown) => {
    if (!IsCommand(cmd)) {
      return;
    }

    const handler = this._routes.get(cmd.id);
    if (!handler) {
      logger.warn(`Unhandled command: id = ${String(cmd.id)}`);
      return;
    }

    try {
      await handler(cmd);
    } catch (e) {
      logger.error(
        `Error while handling command '${String(cmd.id)}': ${String(e)}`
      );
    }
  };

  private readonly _onGetConfigs = async (cmd: Command) => {
    this._postReply(cmd, {
      filePath: this._doc.uri.fsPath,
      fileName: path.basename(this._doc.uri.fsPath),
      additionalDirs: await this._doc.getAdditionalDirs()
    });
  };

  private readonly _onOpenFileInTextEditor = (cmd: Command) => {
    void vscode.window.showTextDocument(this._doc.uri);
    this._postReply(cmd, { status: 'done' });
  };

  private readonly _onOpenFileInTraceViewer = async (cmd: Command) => {
    (await getQmlTraceApi()).open(this._doc.uri);
    this._postReply(cmd, { status: 'done' });
  };

  private readonly _onSetConfigs = (cmd: Command) => {
    const dirs = _.get(cmd.payload, 'additionalDirs', [] as string[]);
    void this._doc.setAdditionalDirs(dirs);
    this._postReply(cmd, { status: 'done' });
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
      let folder = folderUri[0]?.fsPath ?? '';
      if (process.platform === 'win32' && /^[a-z]:/.test(folder)) {
        folder = folder.charAt(0).toUpperCase() + folder.slice(1);
      }

      this._postReply(cmd, { folders: [folder] });
    }
  };

  private readonly _onGetWorkspaceFolders = (cmd: Command) => {
    const folders = (vscode.workspace.workspaceFolders ?? []).map((f) => {
      return f.uri.fsPath;
    });

    this._postReply(cmd, { folders });
  };

  private _postReply(cmd: Command, data: QmlTraceCommandReply) {
    this._comm.postDataReply(cmd, data);
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

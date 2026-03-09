// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import _ from 'lodash';
import * as vscode from 'vscode';

import { createLogger, exists, FileFinder } from 'qt-lib';
import { WebviewChannel } from '@/webview/channel';
import {
  Command,
  CommandId,
  CommandHandler,
  IsCommand
} from '@/webview/shared/message';
import { QmlTraceCommandReply } from '@/webview/shared/qml-trace';
import { QmlTraceDoc } from './doc';
import { QtcliRestClient } from '@/qtcli/rest';

const logger = createLogger('qml-trace-controller');

export class QmlTraceController {
  private readonly _context: vscode.ExtensionContext;
  private readonly _doc: QmlTraceDoc;
  private readonly _comm: WebviewChannel;
  private readonly _qtcli: QtcliRestClient;
  private readonly _routes: Map<CommandId, CommandHandler>;
  private readonly _disposables: vscode.Disposable[] = [];

  public constructor(
    doc: QmlTraceDoc,
    view: vscode.Webview,
    qtcliSocketName: string,
    context: vscode.ExtensionContext
  ) {
    this._context = context;
    this._doc = doc;
    this._comm = new WebviewChannel(view);
    this._qtcli = new QtcliRestClient(qtcliSocketName);

    this._disposables.push(
      this._comm,
      this._comm.onDidReceiveMessage(this._dispatch),
      this._qtcli,
      vscode.window.onDidChangeActiveColorTheme(this._onThemeChanged)
    );

    this._routes = new Map<CommandId, CommandHandler>([
      [CommandId.UiCheckIfQtcliReady, this._onCheckIfQtcliReady],
      [CommandId.QmlTraceLoadFile, this._onLoadFile],
      [CommandId.QmlTraceGetConfigs, this._onGetConfigs],
      [CommandId.QmlTraceSetConfigs, this._onSetConfigs],
      [CommandId.QmlTraceGetFlameGraph, this._onGetFlameGraph],
      [CommandId.QmlTraceOpenSourceFile, this._onOpenSourceFile],
      [CommandId.QmlTraceOpenFileInTextEditor, this._onOpenFileInTextEditor],
      [CommandId.QmlTraceOpenFlameGraphData, this._onOpenFlameGraphData],
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

  private readonly _onThemeChanged = (theme: vscode.ColorTheme) => {
    const cmd = { id: CommandId.CommonVscodeThemeChanged };
    const themeKind = vscode.ColorThemeKind[theme.kind];
    this._postReply(cmd, { themeKind });
  };

  private readonly _onCheckIfQtcliReady = async (cmd: Command) => {
    try {
      const data = await this._qtcli.retryCall({
        method: 'get',
        url: '/ready'
      });
      this._comm.postDataReply(cmd, data);
    } catch {
      logger.error('Error while loading qtcli');
    }
  };

  private readonly _onLoadFile = async (cmd: Command) => {
    const data = await this._qtcli.put('/qmltraces/load', {
      filePath: this._doc.uri.fsPath
    });

    this._comm.postDataReply(cmd, data);
  };

  private readonly _onGetConfigs = (cmd: Command) => {
    this._postReply(cmd, {
      filePath: this._doc.uri.fsPath,
      additionalDirs: this._doc.additionalDirs
    });
  };

  private readonly _onSetConfigs = (cmd: Command) => {
    const dirs = _.get(cmd.payload, 'additionalDirs', [] as string[]);
    void this._doc.setAdditionalDirs(dirs);
    this._postReply(cmd, { status: 'done' });
  };

  private readonly _onGetFlameGraph = async (cmd: Command) => {
    const kind = _.get(cmd.payload, 'kind', '') as string;
    const features = _.get(cmd.payload, 'features', '') as string;
    const data = await this._qtcli.get('/qmltraces/flamegraph', {
      kind,
      features
    });
    this._comm.postDataReply(cmd, data);
  };

  private readonly _onOpenSourceFile = async (cmd: Command) => {
    // format of the source location:
    // "qrc:/qt/qml/content/KissButton.qml#L1,2"
    const loc = _.get(cmd.payload, 'sourceLocation', '') as string;
    const [filePath = '', fragment = ''] = loc.split('#');

    const finder = new FileFinder();
    finder.buildDirs = this._doc.additionalDirs;

    const physicalpath = await finder.findFile(filePath);
    if (!physicalpath) {
      logger.error('Cannot find a QML file for:', filePath);
      return;
    }

    const uri = vscode.Uri.file(physicalpath);
    if (!(await exists(uri.fsPath))) {
      logger.error('Cannot locate the QML file:', uri.fsPath);
      return;
    }

    let line = 1; // one-based
    let column = 1;

    if (fragment) {
      const match = fragment.match(/L(\d+),(\d+)/);
      if (match) {
        const [, lineStr, colStr] = match;
        line = Math.max(1, parseInt(lineStr ?? '0', 10));
        column = Math.max(1, parseInt(colStr ?? '0', 10));
      }
    }

    const position = new vscode.Position(line - 1, column - 1); // zero-based
    const selection = new vscode.Range(position, position);

    void vscode.window.showTextDocument(uri, {
      viewColumn: vscode.ViewColumn.Two,
      selection,
      preview: true
    });
  };

  private readonly _onOpenFileInTextEditor = (cmd: Command) => {
    void vscode.window.showTextDocument(this._doc.uri);
    this._postReply(cmd, { status: 'done' });
  };

  private readonly _onOpenFlameGraphData = async (cmd: Command) => {
    const json = (_.get(cmd.payload, 'json', '') as string).trim();
    if (json.length == 0) {
      // TODO: add a proper handling of this situation
      return;
    }

    const info = this._context.extension.packageJSON as unknown;
    const name = _.get(info, 'name', '') as string;
    const version = _.get(info, 'version', '') as string;
    const publisher = _.get(info, 'publisher', '') as string;

    const header = [
      '// Flame graph data generated from a QML trace.',
      `// - Trace file: ${this._doc.uri.fsPath}`,
      `// - Generated by: ${publisher}.${name} (${version})`,
      `// - Generated time: ${new Date().toISOString()}`,
      '//',
      '// NOTE: The format of this file may change without notice.'
    ];

    const pos = json.indexOf('{');
    const brace = pos !== -1;
    const parts = [
      brace ? json.slice(0, pos + 1) : '{',
      ...header.map((l) => '  ' + l),
      brace ? json.slice(pos + 1) : json
    ];

    const jsonc = {
      content: parts.join('\n'),
      language: 'jsonc'
    };

    void vscode.window.showTextDocument(
      await vscode.workspace.openTextDocument(jsonc),
      vscode.ViewColumn.Beside,
      true
    );

    this._postReply(cmd, { status: 'done' });
  };

  private readonly _onSelectFolder = async (cmd: Command) => {
    const options: vscode.OpenDialogOptions = {
      canSelectMany: false,
      canSelectFiles: false,
      canSelectFolders: true,
      openLabel: 'Select directory'
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

    this._comm.postDataReply(cmd, { folders });
  };

  private _postReply(cmd: Command, data: QmlTraceCommandReply) {
    this._comm.postDataReply(cmd, data);
  }
}

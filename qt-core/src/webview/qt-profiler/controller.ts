// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import _ from 'lodash';
import * as path from 'path';
import {
  env,
  Uri,
  Range,
  Position,
  ViewColumn,
  WebviewPanel as Panel
} from 'vscode';

import {
  exists,
  coreSettings,
  createWrappedLogger,
  DisposableStore
} from 'qt-lib';
import { FilePathResolver } from './file-resolver';
import { WebviewDispatcher } from '@/webview/dispatcher';
import { Command, CommandId } from '@/webview/shared/message';
import { QtProfilerCommandReply } from '@/webview/shared/qt-profiler';
import { QtProfilerDoc } from './doc';
import { fsFile } from '@/fs-utils';

const logger = createWrappedLogger('qtprofiler-controller');

export class QtProfilerController {
  private readonly _dispatcher: WebviewDispatcher;
  private readonly _disposables = new DisposableStore();

  public constructor(
    private readonly _doc: QtProfilerDoc,
    private readonly _panel: Panel,
    private readonly _qtProfilerDistDirUri: Uri
  ) {
    this._dispatcher = new WebviewDispatcher('qt-profiler', this._panel);
    this._dispatcher.setHandlers([
      [CommandId.QtProfilerGetConfig, this._onGetConfig],
      [CommandId.QtProfilerReadTraceData, this._onReadTraceData],
      [CommandId.QtProfilerEventSelected, this._onEventSelected],
      [CommandId.QtProfilerReloadWebviewHtml, this._onReloadWebviewHtml],
      [CommandId.QtProfilerOpenUrl, this._onOpenUrl],
      [CommandId.QtProfilerWriteLog, this._onWriteLog]
    ]);

    this._disposables.push(this._dispatcher);
  }

  public dispose() {
    this._disposables.dispose();
  }

  private readonly _onGetConfig = (cmd: Command) => {
    this._reply(cmd, {
      profilerDistUri: this._panel.webview
        .asWebviewUri(this._qtProfilerDistDirUri)
        .toString()
    });
  };

  private readonly _onReadTraceData = (cmd: Command) => {
    const pathAbs = this._doc.uri.fsPath;

    this._reply(cmd, {
      filePath: pathAbs,
      fileName: path.basename(pathAbs),
      bytes: new Uint8Array(this._doc.readAll())
    });
  };

  private readonly _onEventSelected = (cmd: Command) => {
    if (coreSettings.profiler.openSourceFile.get() ?? false) {
      const params = cmd.payload as Record<string, unknown>;
      void showSourceFile(params);
    }

    this._reply(cmd, { status: 'done' });
  };

  private readonly _onReloadWebviewHtml = (cmd: Command) => {
    const html = this._panel.webview.html;
    this._panel.webview.html = '';
    this._panel.webview.html = html;

    this._reply(cmd, { status: 'done' });
  };

  private readonly _onOpenUrl = (cmd: Command) => {
    const url = String(_.get(cmd.payload, 'url', '')).trim();
    if (url) {
      void env.openExternal(Uri.parse(url));
    }

    this._reply(cmd, { status: 'done' });
  };

  private readonly _onWriteLog = (cmd: Command) => {
    const line = String(_.get(cmd.payload, 'line', '')).trim();
    if (line) {
      logger.text(line).info();
    }

    this._reply(cmd, { status: 'done' });
  };

  private _reply(cmd: Command, data: QtProfilerCommandReply) {
    this._dispatcher.channel.replyData(cmd, data);
  }
}

// helpers
async function showSourceFile(params: Record<string, unknown>) {
  // params: {
  //   columnNumber: number,
  //   lineNumber: number,
  //   sourceFilePath: string
  // }

  const source = _.toString(params.sourceFilePath);
  if (!source.toLowerCase().endsWith('.qml')) {
    return;
  }

  const dirs = coreSettings.profiler.additionalBuildDirs.get() ?? [];
  const resolved = await resolveFsFile(source, dirs);

  if (resolved) {
    const pos = new Position(
      Math.max(0, _.toInteger(params.lineNumber) - 1),
      Math.max(0, _.toInteger(params.columnNumber) - 1)
    );

    fsFile(resolved).openInEditor({
      viewColumn: ViewColumn.Two,
      selection: new Range(pos, pos),
      preview: true
    });
  }
}

async function resolveFsFile(logicalPath: string, dirs: string[]) {
  const resolver = new FilePathResolver(dirs);
  const resolved = await resolver.resolve(logicalPath);
  if (!resolved) {
    logger
      .text('Cannot resolve the file')
      .data('filePath(logical)', logicalPath)
      .error();
    return undefined;
  }

  if (!(await exists(resolved))) {
    logger
      .text('Cannot locate the file')
      .data('exist', 'false')
      .data('filePath(logical)', logicalPath)
      .data('filePath(physical)', resolved)
      .error();
    return undefined;
  }

  return resolved;
}

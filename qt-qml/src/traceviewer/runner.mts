// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs';
import * as vscode from 'vscode';
import * as childProcess from 'child_process';

import { exists, FileFinder, getQtQmlApi } from 'qt-lib';
import { InstallationManager } from './installation-manager.mts';
import { createWrappedLogger } from './helpers/logger-wrapper.ts';
import * as consts from './constants.mts';

const logger = createWrappedLogger('traceviewer-runner');

export class QmlTraceViewerRunner {
  private readonly _onStdout: ((line: string) => void) | undefined;
  private readonly _onStderr: ((line: string) => void) | undefined;
  private readonly _installationManager: InstallationManager;

  private _proc: ReturnType<typeof childProcess.spawn> | undefined;
  private readonly _onDidStopEmitter = new vscode.EventEmitter<void>();

  constructor(
    private readonly _uri: vscode.Uri,
    context: vscode.ExtensionContext
  ) {
    this._installationManager = new InstallationManager(context);
    this._onStderr = (l) => {
      logger.text(' ' + l).info();
    };
    this._onStdout = (l) => {
      logger.text(' ' + l).info();
      void parseJsonOutput(this._uri, l);
    };
  }

  dispose() {
    if (this._proc) {
      logger.text('Terminating the QML trace viewer process').info();
      this._proc.kill('SIGKILL');
    }

    this._proc = undefined;
    this._onDidStopEmitter.dispose();
    logger.text('Runner disposed').info();
  }

  get onDidStop() {
    return this._onDidStopEmitter.event;
  }

  public isValid() {
    const exe = this._resolveViewerExePath();
    return exe ? fs.existsSync(exe) : false;
  }

  public async run() {
    if (this._proc) {
      logger
        .text('QML trace viewer is already running')
        .data('pid', String(this._proc.pid ?? -1))
        .data('path', this._uri.fsPath)
        .error();
      return;
    }

    const exe = this._resolveViewerExePath();
    if (!exe) {
      showViewerNotFoundMessage();
      return;
    }

    const args = [
      '-e', // exit on error
      '-r', // use JSON-RPC 2.0
      this._uri.fsPath
    ];

    logger
      .text('Running command')
      .data('command', exe)
      .data('arguments', args.join(' '))
      .info({ multipleLine: true });

    this._proc = childProcess.spawn(exe, args);
    const outPromise = streamToLines(this._proc.stdout, this._onStdout);
    const errPromise = streamToLines(this._proc.stderr, this._onStderr);

    await new Promise<void>((resolve, reject) => {
      if (this._proc) {
        this._proc.on('error', (err) => {
          logger.text(err.message).error();
          this._clearProcAndFire();
          reject(err);
        });

        this._proc.on('close', (code) => {
          if (code === 0) {
            logger
              .text('Process closed')
              .data('pid', this._proc ? String(this._proc.pid) : '<none>')
              .info();

            this._clearProcAndFire();
            resolve();
            return;
          }

          const msg = logger
            .text('Process exited')
            .data('code', code !== null ? String(code) : '<null>')
            .toString();

          logger.info();
          this._clearProcAndFire();
          reject(new Error(msg));
        });
      }
    });

    const out = await outPromise;
    const err = await errPromise;
    void err;

    return out;
  }

  private _clearProcAndFire() {
    this._proc = undefined;
    this._onDidStopEmitter.fire();
  }

  private _resolveViewerExePath() {
    const custom = vscode.workspace
      .getConfiguration(consts.CONF_SECTION)
      .get<string>(consts.CONF_CUSTOM_TRACE_VIEWER_EXE_PATH, '');

    if (custom.length !== 0) {
      if (fs.existsSync(custom)) {
        logger.text('Found custom viewer').data('path', custom).info();

        return custom;
      }

      logger
        .text('Custom viewer is assigned but invalid')
        .data('path', custom)
        .warn();
    }

    return this._installationManager.activePackageInfo?.execPath;
  }
}

export function showViewerNotFoundMessage() {
  const text = 'QML trace viewer is not found. Please install it first';
  const button = 'Install';

  void vscode.window.showInformationMessage(text, button).then((selected) => {
    if (selected === button) {
      void vscode.commands.executeCommand(consts.COMMAND_DOWNLOAD_VIEWER_FULL);
    }
  });
}

// helpers
function asTrimmedString(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return '';
}

async function parseJsonOutput(uri: vscode.Uri, text: string) {
  const obj = JSON.parse(text) as Record<string, unknown>;
  const version = asTrimmedString(obj.jsonrpc);
  const method = asTrimmedString(obj.method).toLowerCase();
  if (version !== '2.0' || method.length === 0) {
    throw new Error(
      `Invalid JSON-RPC: version = ${version}, method = ${method}`
    );
  }

  if (method === 'traceeventselected') {
    const qmlApi = await getQtQmlApi();
    const dirs = qmlApi?.traceFile.getAdditionalDirs(uri);
    if (!dirs || dirs.length === 0) {
      logger.text('Cannot locate QML file, no additionalDirs assigned').info();
      return;
    }

    const params = (obj.params ?? {}) as Record<string, unknown>;
    const col = parseInt(asTrimmedString(params.columnNumber));
    const line = parseInt(asTrimmedString(params.lineNumber));
    const filePath = asTrimmedString(params.sourceFilePath);

    const finder = new FileFinder();
    finder.buildDirs = dirs;

    const physicalPath = await finder.findFile(filePath);
    if (!physicalPath) {
      logger.text('Cannot resolve QML file').data('filePath', filePath).error();

      return;
    }

    if (!(await exists(physicalPath))) {
      logger
        .text('Cannot open QML file')
        .data('exist', 'false')
        .data('qml-file', physicalPath)
        .error();

      return;
    }

    const physicalUri = vscode.Uri.file(physicalPath);
    const position = new vscode.Position(
      Math.max(0, line - 1),
      Math.max(0, col - 1)
    );

    const selection = new vscode.Range(position, position);
    void vscode.window.showTextDocument(physicalUri, {
      viewColumn: vscode.ViewColumn.Two,
      selection,
      preview: true
    });
  }
}

type Stream = NodeJS.ReadableStream;
type Callback = ((line: string) => void) | undefined;

async function streamToLines(stream: Stream | null, callback: Callback) {
  if (stream === null) {
    return;
  }

  let leftover = '';
  const lines: string[] = [];

  for await (const chunk of stream) {
    const text = leftover + chunk.toString();
    const parts = text.split('\n');
    leftover = parts.pop() ?? '';

    for (const line of parts) {
      const trimmed = line.trim();
      lines.push(trimmed);
      callback?.(trimmed);
    }
  }

  if (leftover.trim()) {
    const trimmed = leftover.trim();
    lines.push(trimmed);
    callback?.(trimmed);
  }

  return lines;
}

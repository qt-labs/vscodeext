// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { QtQmlAPI, QmlTraceFileAPI } from 'qt-lib';
import {
  QmlTraceViewerRunner,
  showViewerNotFoundMessage
} from './traceviewer/runner.mts';

export class QtQmlAPIImpl implements QtQmlAPI, vscode.Disposable {
  private readonly _traceFile: TraceFileAPIImpl;

  constructor(context: vscode.ExtensionContext) {
    this._traceFile = new TraceFileAPIImpl(context);
  }

  dispose() {
    this._traceFile.dispose();
  }

  get traceFile() {
    return this._traceFile;
  }
}

// helpers
class TraceFileAPIImpl implements QmlTraceFileAPI, vscode.Disposable {
  private readonly _viewers = new Map<string, QmlTraceViewerRunner>();
  constructor(private readonly _context: vscode.ExtensionContext) {}

  dispose() {
    for (const viewer of this._viewers.values()) {
      viewer.dispose();
    }

    this._viewers.clear();
  }

  open(uri: vscode.Uri) {
    const fsPath = uri.fsPath;
    if (this._viewers.has(fsPath)) {
      const viewer = this._viewers.get(fsPath);
      if (viewer?.isValid()) {
        return;
      }

      this._disposeViewer(fsPath);
    }

    const viewer = new QmlTraceViewerRunner(uri, this._context);
    if (!viewer.isValid()) {
      viewer.dispose();
      showViewerNotFoundMessage();
      return;
    }

    viewer.onDidStop(() => {
      this._disposeViewer(fsPath);
    });

    this._viewers.set(fsPath, viewer);
    void viewer.run();
  }

  close(uri: vscode.Uri) {
    this._disposeViewer(uri.fsPath);
  }

  getAdditionalDirs(uri: vscode.Uri) {
    const key = createKeyForTraceFile(uri);
    return this._context.globalState.get<string[]>(key) ?? [];
  }

  setAdditionalDirs(uri: vscode.Uri, dirs: string[]) {
    const key = createKeyForTraceFile(uri);
    void this._context.globalState.update(key, dirs);
  }

  private _disposeViewer(fsPath: string) {
    const viewer = this._viewers.get(fsPath);
    if (viewer) {
      viewer.dispose();
      this._viewers.delete(fsPath);
    }
  }
}

function createKeyForTraceFile(uri: vscode.Uri) {
  return `qmlTrace.additionalDirs:${uri.fsPath}`;
}

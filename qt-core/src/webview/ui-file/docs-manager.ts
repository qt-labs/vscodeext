// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { UiFileDoc, defaultUiFileText } from './doc';

export class UiFileDocsManager {
  private readonly _allDocs = new Map<string, UiFileDoc>();
  private readonly _disposables: vscode.Disposable[] = [];

  constructor() {
    this._disposables.push(
      vscode.workspace.onDidCloseTextDocument(this._onDocClosed.bind(this))
    );
  }

  public dispose() {
    this._allDocs.clear();
    this._disposables.forEach((e) => {
      e.dispose();
    });
  }

  public find(key: string): UiFileDoc | undefined {
    return this._allDocs.get(key);
  }

  public add(doc: vscode.TextDocument) {
    const key = doc.uri.fsPath;

    if (!this._allDocs.has(key)) {
      this._allDocs.set(key, new UiFileDoc(doc));
      void ensureNotEmpty(doc);
    }
  }

  private _onDocClosed(vsdoc: vscode.TextDocument) {
    const key = vsdoc.uri.fsPath;
    const doc = this._allDocs.get(key);
    if (doc) {
      this._allDocs.delete(key);
    }
  }
}

// helpers
async function ensureNotEmpty(doc: vscode.TextDocument) {
  const noLines = doc.lineCount === 0;
  const oneLineButEmpty =
    doc.lineCount === 1 &&
    doc
      .getText()
      .replace(/^\uFEFF/, '')
      .trim().length === 0;

  if (!noLines && !oneLineButEmpty) {
    return undefined;
  }

  const edit = new vscode.WorkspaceEdit();
  const range = new vscode.Range(0, 0, doc.lineCount, 0);
  edit.replace(doc.uri, range, defaultUiFileText);

  await vscode.workspace.applyEdit(edit);
  await doc.save();
}

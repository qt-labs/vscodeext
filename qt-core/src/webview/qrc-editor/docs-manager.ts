// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { QrcDocChangeEvent } from '@/webview/shared/qrc-types';
import { defaultQrcLines } from './xml-io';
import { QrcDoc } from './doc';
import { CommandId } from '../shared/message';

export class QrcDocsManager {
  private readonly _allDocs = new Map<string, QrcDoc>();
  private readonly _recentCommandIds = new Map<string, CommandId>();
  private readonly _changeEmitter =
    new vscode.EventEmitter<QrcDocChangeEvent>();
  private readonly _disposables: vscode.Disposable[] = [];

  constructor() {
    this._disposables.push(
      vscode.workspace.onDidCloseTextDocument(this._onDocClosed.bind(this)),
      vscode.workspace.onDidChangeTextDocument(this._onDocChanged.bind(this))
    );
  }

  public dispose() {
    this._allDocs.clear();
    this._disposables.forEach((e) => {
      e.dispose();
    });
  }

  public get onChange() {
    return this._changeEmitter.event;
  }

  public find(key: string): QrcDoc | undefined {
    return this._allDocs.get(key);
  }

  public add(doc: vscode.TextDocument) {
    const key = doc.uri.fsPath;

    if (!this._allDocs.has(key)) {
      this._allDocs.set(key, new QrcDoc(doc));
      void ensureNotEmpty(doc);
    }
  }

  public setRecentCommandId(key: string, commandId: CommandId) {
    this._recentCommandIds.set(key, commandId);
  }

  private _onDocClosed(vsdoc: vscode.TextDocument) {
    const key = vsdoc.uri.fsPath;
    const doc = this._allDocs.get(key);
    if (doc) {
      this._allDocs.delete(key);
    }
  }

  private _onDocChanged(e: vscode.TextDocumentChangeEvent) {
    const key = e.document.uri.fsPath;
    const doc = this._allDocs.get(key);
    if (doc) {
      const ev = this._createChangeEvent(key, e);
      if (ev.reason !== 'command') {
        doc.reloadXmlVsdoc();
      }

      this._changeEmitter.fire(ev);
    }
  }

  private _createChangeEvent(
    key: string,
    e: vscode.TextDocumentChangeEvent
  ): QrcDocChangeEvent {
    const commandId = this._recentCommandIds.get(key);
    if (commandId) {
      this._recentCommandIds.delete(key);
      return { key, reason: 'command', commandId };
    }

    if (
      e.reason === vscode.TextDocumentChangeReason.Undo ||
      e.reason === vscode.TextDocumentChangeReason.Redo
    ) {
      return { key, reason: 'undo/redo' };
    }

    return { key, reason: 'not-specified' };
  }
}

// helpers
async function ensureNotEmpty(doc: vscode.TextDocument) {
  const nolines = doc.lineCount === 0;
  const oneLineButEmpty =
    doc.lineCount === 1 &&
    doc
      .getText()
      .replace(/^\uFEFF/, '')
      .trim().length === 0;

  if (!nolines && !oneLineButEmpty) {
    return undefined;
  }

  const edit = new vscode.WorkspaceEdit();
  const range = new vscode.Range(0, 0, doc.lineCount, 0);
  edit.replace(doc.uri, range, defaultQrcLines().join('\n'));

  return vscode.workspace.applyEdit(edit);
}

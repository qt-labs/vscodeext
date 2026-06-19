// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

export class AccountViewProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    vscode.TreeItem | undefined | null
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _treeView: vscode.TreeView<vscode.TreeItem> | undefined;

  setTreeView(treeView: vscode.TreeView<vscode.TreeItem>): void {
    this._treeView = treeView;
  }

  setSession(session: vscode.AuthenticationSession | undefined): void {
    if (this._treeView) {
      this._treeView.description = session?.account.label ?? '';
    }
    this._onDidChangeTreeData.fire(undefined);
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  getChildren(): vscode.TreeItem[] {
    return [];
  }
}

// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { EXTENSION_ID } from '@/constants';
import { listInstalledVersionsOnDisk } from '@/installed-packages-store';

/** Tree item for one installed Qt version; `version` is read by removePackage. */
export class InstalledPackageItem extends vscode.TreeItem {
  constructor(readonly version: string) {
    super(`Qt ${version}`, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'installedPackage';
  }
}

export class InstalledPackagesViewProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    vscode.TreeItem | undefined | null
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  getChildren(): vscode.TreeItem[] {
    const versionItems: vscode.TreeItem[] = listInstalledVersionsOnDisk().map(
      (version) => new InstalledPackageItem(version)
    );
    const installOther = new vscode.TreeItem(
      'Install other versions',
      vscode.TreeItemCollapsibleState.None
    );
    installOther.iconPath = new vscode.ThemeIcon('add');
    installOther.command = {
      command: `${EXTENSION_ID}.installPackage`,
      title: 'Install other versions'
    };
    return [...versionItems, installOther];
  }
}

let provider: InstalledPackagesViewProvider | undefined;

export function registerInstalledPackagesView(
  context: vscode.ExtensionContext
): void {
  provider = new InstalledPackagesViewProvider();
  const treeView = vscode.window.createTreeView(
    `${EXTENSION_ID}.installedPackagesView`,
    { treeDataProvider: provider }
  );
  context.subscriptions.push(treeView);
}

/** Re-read the installed versions from disk and re-render the view. */
export function refreshInstalledPackagesView(): void {
  provider?.refresh();
}

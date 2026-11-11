// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { Packages, type PackageData } from 'sms-api';

import { createLogger } from 'qt-lib';
import { EXTENSION_ID } from '@/constants';
import { getInstallRoot } from '@/install-root';
import { ensureConnected } from '@/service-connection';
import {
  groupFrameworkVersions,
  packageLabel,
  type InstalledQtVersion
} from '@/installed-packages-store';

const logger = createLogger('installed-packages-view');

const VIEW_ID = `${EXTENSION_ID}.installedPackagesView`;
// Read by the welcome content of the view: 'loading', 'loaded' or 'failed'.
const STATE_CONTEXT_KEY = `${EXTENSION_ID}.installedPackagesState`;
// Disk events of an install made outside the extension arrive in bursts;
// one refresh after the last of them is enough.
const REFRESH_DEBOUNCE_MS = 500;

type LoadState = 'loading' | 'loaded' | 'failed';

/** Tree item for one installed Qt version; `version` is read by removePackage. */
export class InstalledPackageItem extends vscode.TreeItem {
  constructor(
    readonly version: string,
    installRoot: string
  ) {
    super(`Qt ${version}`, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = 'installedPackage';
    this.tooltip = `Qt ${version} in ${installRoot}`;
  }
}

/** Tree item for one package of a Qt version, for example its add-ons. */
class InstalledQtPackageItem extends vscode.TreeItem {
  constructor(pkg: PackageData) {
    super(packageLabel(pkg), vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'installedQtPackage';
    this.tooltip = `${pkg.id}@${pkg.version}`;
    this.iconPath = new vscode.ThemeIcon('package');
  }
}

/**
 * The installed Qt versions as the Qt Software Management Service records
 * them for the configured installation root, read with `packages/list`.
 *
 * The view starts in the loading state, with a progress bar, until the
 * service is connected and has answered. A failure, for example a journal
 * the service cannot use, is shown in the view with a Retry item instead
 * of a notification.
 */
export class InstalledPackagesViewProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    vscode.TreeItem | undefined | null
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private view: vscode.TreeView<vscode.TreeItem> | undefined;
  private state: LoadState = 'loading';
  private versions: InstalledQtVersion[] = [];
  private installRoot = '';
  private errorMessage = '';
  // Label of the install or removal that runs, shown at the top of the view.
  private operation: string | undefined;

  private refreshing: Promise<void> | undefined;
  private refreshAgain = false;
  private debounceTimer: NodeJS.Timeout | undefined;

  /**
   * Read the installed versions from the service again. A refresh asked
   * for while one runs makes it run once more afterwards, so that the view
   * always ends up showing the latest answer.
   */
  async refresh(): Promise<void> {
    if (this.refreshing) {
      this.refreshAgain = true;
      return this.refreshing;
    }
    this.refreshing = this.load().finally(() => {
      this.refreshing = undefined;
      if (this.refreshAgain) {
        this.refreshAgain = false;
        void this.refresh();
      }
    });
    return this.refreshing;
  }

  /** Refresh once the burst of events that asked for it is over. */
  scheduleRefresh(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = undefined;
      void this.refresh();
    }, REFRESH_DEBOUNCE_MS);
  }

  /**
   * Show the progress bar of the view while `serviceReady` is pending and
   * read the installed versions once it settles. For the activation, where
   * the bootstrap may still be installing or starting the service.
   */
  loadAfter(serviceReady: Promise<unknown>): void {
    this.setState('loading');
    void vscode.window.withProgress(
      { location: { viewId: VIEW_ID } },
      async () => {
        await serviceReady.catch(() => undefined);
        await this.refresh();
      }
    );
  }

  /**
   * Show a running install or removal: an item with a spinner at the top
   * of the view and the progress bar of the view, until `operation`
   * settles. The view would otherwise say that nothing is installed while
   * the first version downloads, because the disk watcher stays quiet
   * during the operation and the service lists it only once it is done.
   */
  showOperation(label: string, operation: Promise<unknown>): void {
    this.operation = label;
    this._onDidChangeTreeData.fire(undefined);
    void vscode.window.withProgress(
      { location: { viewId: VIEW_ID } },
      async () => {
        await operation.then(
          () => undefined,
          () => undefined
        );
        if (this.operation === label) {
          this.operation = undefined;
          this._onDidChangeTreeData.fire(undefined);
        }
      }
    );
  }

  dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
    this._onDidChangeTreeData.dispose();
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
    if (element instanceof InstalledPackageItem) {
      const group = this.versions.find((v) => v.version === element.version);
      return (group?.packages ?? []).map(
        (pkg) => new InstalledQtPackageItem(pkg)
      );
    }
    if (element) {
      return [];
    }
    const items = this.rootItems();
    return this.operation
      ? [this.operationItem(this.operation), ...items]
      : items;
  }

  private rootItems(): vscode.TreeItem[] {
    switch (this.state) {
      case 'loading':
        // The welcome content says what is happening.
        return [];
      case 'failed':
        return [this.errorItem(), this.retryItem()];
      case 'loaded':
        if (this.versions.length === 0) {
          // The welcome content offers to install Qt.
          return [];
        }
        return [
          ...this.versions.map(
            (v) => new InstalledPackageItem(v.version, this.installRoot)
          ),
          this.installOtherItem()
        ];
    }
  }

  private async load(): Promise<void> {
    this.setState('loading');
    await vscode.window.withProgress(
      { location: { viewId: VIEW_ID } },
      async () => {
        const installRoot = getInstallRoot();
        if (!installRoot) {
          this.installRoot = '';
          this.versions = [];
          this.setState('loaded');
          return;
        }
        try {
          const session = await ensureConnected({ silent: true });
          const { packages, installRoot: resolved } = await new Packages(
            session
          ).listInstalledPackages({ installRoot }, { packageType: 'alias' });
          this.installRoot = resolved || installRoot;
          this.versions = groupFrameworkVersions(packages);
          logger.info(
            `Installed Qt versions in ${this.installRoot}: ${
              this.versions.map((v) => v.version).join(', ') || 'none'
            }`
          );
          this.setState('loaded');
        } catch (err) {
          this.errorMessage = err instanceof Error ? err.message : String(err);
          logger.error(
            `Cannot read the installed Qt versions: ${this.errorMessage}`
          );
          this.setState('failed');
        }
      }
    );
  }

  /** The tree view of this provider, which shows the root in its title. */
  attachView(view: vscode.TreeView<vscode.TreeItem>): void {
    this.view = view;
    this.showInstallRoot();
  }

  private setState(state: LoadState): void {
    this.state = state;
    void vscode.commands.executeCommand('setContext', STATE_CONTEXT_KEY, state);
    this.showInstallRoot();
    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Show the installation root next to the view title: the root the
   * service resolved once it answered, the configured one before that.
   */
  private showInstallRoot(): void {
    if (!this.view) {
      return;
    }
    const root =
      this.state === 'loaded' && this.installRoot
        ? this.installRoot
        : getInstallRoot();
    this.view.description = root ? shortenHome(root) : 'No installation path';
  }

  private errorItem(): vscode.TreeItem {
    const item = new vscode.TreeItem(
      'Could not read the installed Qt versions',
      vscode.TreeItemCollapsibleState.None
    );
    item.description = this.errorMessage;
    item.tooltip = this.errorMessage;
    item.iconPath = new vscode.ThemeIcon('warning');
    return item;
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  private operationItem(label: string): vscode.TreeItem {
    const item = new vscode.TreeItem(
      `${label}...`,
      vscode.TreeItemCollapsibleState.None
    );
    item.iconPath = new vscode.ThemeIcon('loading~spin');
    return item;
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  private retryItem(): vscode.TreeItem {
    const item = new vscode.TreeItem(
      'Retry',
      vscode.TreeItemCollapsibleState.None
    );
    item.iconPath = new vscode.ThemeIcon('refresh');
    item.command = {
      command: `${EXTENSION_ID}.refreshInstalledPackages`,
      title: 'Retry'
    };
    return item;
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  private installOtherItem(): vscode.TreeItem {
    const item = new vscode.TreeItem(
      'Install other versions',
      vscode.TreeItemCollapsibleState.None
    );
    item.iconPath = new vscode.ThemeIcon('add');
    item.command = {
      command: `${EXTENSION_ID}.installPackage`,
      title: 'Install other versions'
    };
    return item;
  }
}

/** `~/QtAlpha` instead of `/home/user/QtAlpha`, like VS Code shows paths. */
function shortenHome(dir: string): string {
  const home = os.homedir();
  if (dir === home) {
    return '~';
  }
  return dir.startsWith(home + path.sep) ? `~${dir.slice(home.length)}` : dir;
}

let provider: InstalledPackagesViewProvider | undefined;

export function registerInstalledPackagesView(
  context: vscode.ExtensionContext
): void {
  provider = new InstalledPackagesViewProvider();
  const treeView = vscode.window.createTreeView(VIEW_ID, {
    treeDataProvider: provider
  });
  provider.attachView(treeView);
  context.subscriptions.push(treeView, provider);
}

/**
 * Start reading the installed versions once `serviceReady` settles, with
 * the progress bar of the view shown meanwhile. Does not block the caller.
 */
export function loadInstalledPackagesAfter(
  serviceReady: Promise<unknown>
): void {
  provider?.loadAfter(serviceReady);
}

/** Read the installed versions from the service again and re-render. */
export async function refreshInstalledPackages(): Promise<void> {
  await provider?.refresh();
}

/** Like refreshInstalledPackages, once a burst of change events is over. */
export function scheduleInstalledPackagesRefresh(): void {
  provider?.scheduleRefresh();
}

/**
 * Show a running install or removal in the view until `operation` settles.
 * `label` is what runs, for example "Installing Qt 6.9.0".
 */
export function showInstalledPackagesOperation(
  label: string,
  operation: Promise<unknown>
): void {
  provider?.showOperation(label, operation);
}

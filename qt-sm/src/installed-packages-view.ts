// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs';
import * as vscode from 'vscode';
import { Packages } from 'sms-api';

import { createLogger } from 'qt-lib';
import { EXTENSION_ID } from '@/constants';
import { getInstallRoot } from '@/install-root';
import { ensureConnected } from '@/service-connection';
import {
  groupFrameworkVersions,
  setInstalledVersions,
  type InstalledQtVersion
} from '@/installed-packages-store';

const logger = createLogger('installed-packages-view');

const VIEW_ID = `${EXTENSION_ID}.installedPackagesView`;
// Context value of the installation root item, which has the reveal button.
const INSTALL_ROOT_CONTEXT = 'installRoot';
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
    super(`Qt ${version}`, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'installedPackage';
    this.iconPath = new vscode.ThemeIcon('package');
    this.tooltip = `Qt ${version} in ${installRoot}`;
  }
}

/**
 * The installed Qt versions as the Qt Software Management Service records
 * them for the configured installation root, read with `packages/list`.
 *
 * The first item is always the installation root, with a button that
 * reveals it in the file explorer. Below it the view says that it is
 * loading, with a progress bar, until the service is connected and has
 * answered. A failure, for example a journal
 * the service cannot use, is shown in the view with a Retry item instead
 * of a notification.
 */
export class InstalledPackagesViewProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    vscode.TreeItem | undefined | null
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private state: LoadState = 'loading';
  private versions: InstalledQtVersion[] = [];
  private installRoot = '';
  private errorMessage = '';
  // The item of the install or removal that runs, shown at the top of the
  // view, or in place of the version a removal removes. Kept across renders
  // so that a progress update re-renders only it.
  private operation: vscode.TreeItem | undefined;
  // The version the running removal removes, whose item it replaces.
  private operationReplaces: string | undefined;

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
   *
   * A removal passes the version it removes as `replaces`: its item shows
   * in place of that version instead of at the top. Once the removal
   * succeeds the version stays hidden, so that it does not show again
   * until the refresh that follows drops it.
   */
  showOperation(
    label: string,
    operation: Promise<unknown>,
    replaces?: string
  ): void {
    const item = operationItem(label);
    this.operation = item;
    this.operationReplaces = replaces;
    this._onDidChangeTreeData.fire(undefined);
    void vscode.window.withProgress(
      { location: { viewId: VIEW_ID } },
      async () => {
        const succeeded = await operation.then(
          () => true,
          () => false
        );
        if (this.operation === item) {
          if (succeeded && replaces !== undefined) {
            this.versions = this.versions.filter((v) => v.version !== replaces);
          }
          this.operation = undefined;
          this.operationReplaces = undefined;
          this._onDidChangeTreeData.fire(undefined);
        }
      }
    );
  }

  /**
   * Show how far the running operation is: `label` says what it does now,
   * for example "Downloading Qt 6.9.0", and `percent` how far that is.
   * The item says what runs only once the service reports progress, so a
   * report that does not change what the item shows renders nothing.
   */
  reportOperationProgress(label: string, percent: number): void {
    const item = this.operation;
    if (!item) {
      return;
    }
    const pct = Math.min(100, Math.max(0, Math.round(percent)));
    const description = progressText(pct);
    if (item.label === label && item.description === description) {
      return;
    }
    item.label = label;
    item.description = description;
    item.tooltip = `${label}: ${String(pct)}%`;
    this._onDidChangeTreeData.fire(item);
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
    if (element) {
      return [];
    }
    const items = this.rootItems();
    if (this.operation && !this.replacesVersionItem(items)) {
      items.unshift(this.operation);
    }
    return [this.installRootItem(), ...items];
  }

  /**
   * Put the item of the running removal in place of the item of the
   * version it removes. Returns whether that version was listed.
   */
  private replacesVersionItem(items: vscode.TreeItem[]): boolean {
    const { operation, operationReplaces } = this;
    if (!operation || operationReplaces === undefined) {
      return false;
    }
    const index = items.findIndex(
      (i) =>
        i instanceof InstalledPackageItem && i.version === operationReplaces
    );
    if (index < 0) {
      return false;
    }
    items[index] = operation;
    return true;
  }

  /** The root the service resolved once it answered, the configured one before that. */
  currentInstallRoot(): string | undefined {
    return this.state === 'loaded' && this.installRoot
      ? this.installRoot
      : getInstallRoot();
  }

  private installRootItem(): vscode.TreeItem {
    const root = this.currentInstallRoot();
    if (!root) {
      const item = new vscode.TreeItem(
        'Set the installation path',
        vscode.TreeItemCollapsibleState.None
      );
      item.iconPath = new vscode.ThemeIcon('folder');
      item.tooltip = 'The installation path is not set.';
      item.command = {
        command: `${EXTENSION_ID}.setInstallationPath`,
        title: 'Set the installation path'
      };
      return item;
    }
    const item = new vscode.TreeItem(
      root,
      vscode.TreeItemCollapsibleState.None
    );
    item.contextValue = INSTALL_ROOT_CONTEXT;
    item.iconPath = new vscode.ThemeIcon('folder');
    item.tooltip = `Installation root: ${root}`;
    return item;
  }

  private rootItems(): vscode.TreeItem[] {
    switch (this.state) {
      case 'loading':
        return [loadingItem()];
      case 'failed':
        return [this.errorItem(), this.retryItem()];
      case 'loaded':
        if (this.versions.length === 0) {
          return [noVersionsItem(), this.installItem('Install Qt')];
        }
        return [
          ...this.versions.map(
            (v) => new InstalledPackageItem(v.version, this.installRoot)
          ),
          this.installItem('Install other versions')
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
          this.setVersions([]);
          this.setState('loaded');
          return;
        }
        try {
          const session = await ensureConnected({ silent: true });
          const { packages, installRoot: resolved } = await new Packages(
            session
          ).listInstalledPackages({ installRoot }, { packageType: 'alias' });
          this.installRoot = resolved || installRoot;
          this.setVersions(groupFrameworkVersions(packages));
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
          // What is installed is not known any more.
          this.setVersions([]);
          this.setState('failed');
        }
      }
    );
  }

  /** Keep the versions for the view and tell the rest of the extension. */
  private setVersions(versions: InstalledQtVersion[]): void {
    this.versions = versions;
    setInstalledVersions(versions);
  }

  private setState(state: LoadState): void {
    this.state = state;
    this._onDidChangeTreeData.fire(undefined);
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
  private installItem(label: string): vscode.TreeItem {
    const item = new vscode.TreeItem(
      label,
      vscode.TreeItemCollapsibleState.None
    );
    item.iconPath = new vscode.ThemeIcon('add');
    item.command = {
      command: `${EXTENSION_ID}.installPackage`,
      title: label
    };
    return item;
  }
}

/** Shown below the installation root until the service has answered. */
function loadingItem(): vscode.TreeItem {
  const item = new vscode.TreeItem(
    'Reading the installed Qt versions...',
    vscode.TreeItemCollapsibleState.None
  );
  item.iconPath = new vscode.ThemeIcon('loading~spin');
  item.tooltip =
    'Connecting to the Qt Software Management Service and reading the installed Qt versions';
  return item;
}

function noVersionsItem(): vscode.TreeItem {
  const item = new vscode.TreeItem(
    'No Qt versions are installed',
    vscode.TreeItemCollapsibleState.None
  );
  item.iconPath = new vscode.ThemeIcon('info');
  return item;
}

/**
 * Show the installation root in the file explorer of the operating
 * system. Reached from the button of the installation root item.
 */
async function revealInstallRoot(): Promise<void> {
  const root = provider?.currentInstallRoot() ?? getInstallRoot();
  if (!root) {
    return;
  }
  try {
    await fs.promises.access(root);
  } catch {
    void vscode.window.showWarningMessage(
      `The installation root ${root} does not exist yet.`
    );
    return;
  }
  await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(root));
}

let provider: InstalledPackagesViewProvider | undefined;

export function registerInstalledPackagesView(
  context: vscode.ExtensionContext
): void {
  provider = new InstalledPackagesViewProvider();
  const treeView = vscode.window.createTreeView(VIEW_ID, {
    treeDataProvider: provider
  });
  context.subscriptions.push(
    treeView,
    provider,
    vscode.commands.registerCommand(
      `${EXTENSION_ID}.revealInstallRoot`,
      revealInstallRoot
    )
  );
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

// Number of cells of the text progress bar of a running operation.
const PROGRESS_BAR_CELLS = 10;

/** A text progress bar, for example `▰▰▰▰▱▱▱▱▱▱ 42%`. */
function progressText(percent: number): string {
  const filled = Math.floor((percent * PROGRESS_BAR_CELLS) / 100);
  return `${'▰'.repeat(filled)}${'▱'.repeat(
    PROGRESS_BAR_CELLS - filled
  )} ${String(percent)}%`;
}

/** The item of a running install or removal, before progress is known. */
function operationItem(label: string): vscode.TreeItem {
  const item = new vscode.TreeItem(
    `${label}...`,
    vscode.TreeItemCollapsibleState.None
  );
  item.iconPath = new vscode.ThemeIcon('loading~spin');
  return item;
}

/**
 * Show a running install or removal in the view until `operation` settles.
 * `label` is what runs, for example "Installing Qt 6.9.0". A removal names
 * the version it removes as `replaces`, whose item it is shown in place of.
 */
export function showInstalledPackagesOperation(
  label: string,
  operation: Promise<unknown>,
  replaces?: string
): void {
  provider?.showOperation(label, operation, replaces);
}

/**
 * Show the progress of the operation shown with
 * showInstalledPackagesOperation in its item. `label` says what runs now,
 * for example "Downloading Qt 6.9.0", and `percent` how far it is.
 */
export function reportInstalledPackagesProgress(
  label: string,
  percent: number
): void {
  provider?.reportOperationProgress(label, percent);
}

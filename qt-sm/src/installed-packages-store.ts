// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as path from 'path';
import type { PackageData } from 'sms-api';

import { EXTENSION_ID, CONF_INSTALLATION_PATH } from '@/constants';
import { getInstallRoot } from '@/install-root';
import {
  QT_FRAMEWORK,
  listProductVersions,
  productDir
} from '@/install-layout';
import { isPackageOperationRunning } from '@/install-state';

const QT_FRAMEWORK_PRODUCT = 'qtframework';

/** The name to show for a package: its display name, else its name or id. */
export function packageLabel(pkg: PackageData): string {
  return pkg.displayNames[0] ?? (pkg.name || pkg.id);
}

/**
 * Whether a package is part of the Qt Framework, and of `version` when one
 * is given. The backend names the product; the id carries it too, for
 * packages the journal recorded without one.
 */
export function isFrameworkPackage(
  pkg: PackageData,
  version?: string
): boolean {
  if (version !== undefined && pkg.version !== version) {
    return false;
  }
  return (
    pkg.product === QT_FRAMEWORK_PRODUCT ||
    pkg.id.includes(`.${QT_FRAMEWORK_PRODUCT}.`)
  );
}

/** A Qt version the service has installed, with its packages. */
export interface InstalledQtVersion {
  readonly version: string;
  /** The packages of the version, sorted by label. */
  readonly packages: PackageData[];
}

/**
 * Group the Qt Framework packages of a `packages/list` answer by version,
 * newest first. Packages of other products, such as the build tools, are
 * left out: the view lists Qt versions.
 */
export function groupFrameworkVersions(
  packages: readonly PackageData[]
): InstalledQtVersion[] {
  const byVersion = new Map<string, PackageData[]>();
  for (const pkg of packages) {
    if (!isFrameworkPackage(pkg)) {
      continue;
    }
    const group = byVersion.get(pkg.version);
    if (group) {
      group.push(pkg);
    } else {
      byVersion.set(pkg.version, [pkg]);
    }
  }
  return [...byVersion.entries()]
    .map(([version, group]) => ({
      version,
      packages: group.sort((a, b) =>
        packageLabel(a).localeCompare(packageLabel(b))
      )
    }))
    .sort((a, b) =>
      b.version.localeCompare(a.version, undefined, {
        numeric: true,
        sensitivity: 'base'
      })
    );
}

// The Qt versions of the last `packages/list` answer, newest first. Empty
// until the service has answered, and after an answer that failed.
let installedVersions: readonly InstalledQtVersion[] = [];
const installedVersionsEmitter = new vscode.EventEmitter<void>();

/**
 * Fires when the Qt versions the service reports as installed change, see
 * setInstalledVersions().
 */
export const onDidChangeInstalledVersions = installedVersionsEmitter.event;

/**
 * Remember the Qt versions of a `packages/list` answer. The Installed
 * Packages view calls this each time it has read them, so the rest of the
 * extension asks the same answer and does not look on disk, where the
 * layout is up to the service.
 */
export function setInstalledVersions(
  versions: readonly InstalledQtVersion[]
): void {
  const before = installedVersions.map((v) => v.version).join('\n');
  installedVersions = versions;
  if (versions.map((v) => v.version).join('\n') !== before) {
    installedVersionsEmitter.fire();
  }
}

/**
 * Whether the service reports at least one Qt Framework version in the
 * installation root. False until the service has answered.
 */
export function isAnyVersionInstalled(): boolean {
  return installedVersions.length > 0;
}

/**
 * Check whether a Qt version is installed on disk, for versions the service
 * does not report. See install-layout.ts for the folder structure.
 */
export function isVersionInstalledOnDisk(version: string): boolean {
  const installRoot = getInstallRoot();
  if (!installRoot) {
    return false;
  }
  return listProductVersions(installRoot, QT_FRAMEWORK).includes(version);
}

let diskWatchers: vscode.FileSystemWatcher[] = [];

/**
 * Watch the Qt framework installation directory on disk and invoke `onChange`
 * whenever a version folder is added or removed — e.g. an install/uninstall
 * done outside the extension, or a manual change. What is installed is then
 * read from the service again; the disk only says when to ask. The watcher re-targets
 * automatically when the installation-root setting changes.
 */
export function watchInstalledPackagesOnDisk(
  context: vscode.ExtensionContext,
  onChange: () => void
): void {
  const retarget = () => {
    diskWatchers.forEach((w) => {
      w.dispose();
    });
    diskWatchers = [];

    const installRoot = getInstallRoot();
    if (!installRoot) {
      return;
    }

    // Ignore disk churn while an install or a removal is changing the
    // folder — the intermediate states are noise. The operation reads the
    // installed versions again itself once it completes.
    const handle = () => {
      if (isPackageOperationRunning()) {
        return;
      }
      onChange();
    };

    const addWatcher = (base: string, glob: string) => {
      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(vscode.Uri.file(base), glob)
      );
      watcher.onDidCreate(handle);
      watcher.onDidDelete(handle);
      diskWatchers.push(watcher);
    };

    // Non-recursive watch of the immediate children (the version folders).
    addWatcher(productDir(installRoot, QT_FRAMEWORK), '*');

    // The watcher above is anchored inside the installation root, so it cannot
    // observe the root itself being removed. Deleting the installation root
    // wipes the Qt versions along with it, which must be noticed as well.
    // Watch the root entry from its parent so its deletion (and re-creation) is
    // reported. Skip when the root has no parent (e.g. a filesystem root).
    const installRootParent = path.dirname(installRoot);
    if (installRootParent && installRootParent !== installRoot) {
      addWatcher(installRootParent, path.basename(installRoot));
    }
  };

  retarget();

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(`${EXTENSION_ID}.${CONF_INSTALLATION_PATH}`)) {
        retarget();
      }
    }),
    {
      dispose: () => {
        diskWatchers.forEach((w) => {
          w.dispose();
        });
        diskWatchers = [];
      }
    }
  );
}

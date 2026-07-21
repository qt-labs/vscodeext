// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { resolveConfiguration } from 'qt-lib';
import { EXTENSION_ID, CONF_INSTALLATION_PATH } from '@/constants';
import { isInstalling } from '@/install-state';

/**
 * Check whether a Qt version is installed on disk.
 * Folder structure: <installationPath>/QtFramework/<version>/
 */
export function isVersionInstalledOnDisk(version: string): boolean {
  const config = vscode.workspace.getConfiguration(EXTENSION_ID);
  const rawPath = config.get<string>(CONF_INSTALLATION_PATH);
  if (!rawPath) {
    return false;
  }
  const installPath = resolveConfiguration(rawPath);
  const versionDir = path.join(installPath, 'QtFramework', version);
  return fs.existsSync(versionDir) && fs.statSync(versionDir).isDirectory();
}

/**
 * Check whether any Qt version is installed on disk.
 * Returns true if <installationPath>/QtFramework/ contains at least one
 * subdirectory.
 */
export function isAnyVersionInstalledOnDisk(): boolean {
  const config = vscode.workspace.getConfiguration(EXTENSION_ID);
  const rawPath = config.get<string>(CONF_INSTALLATION_PATH);
  if (!rawPath) {
    return false;
  }
  const installPath = resolveConfiguration(rawPath);
  const frameworkDir = path.join(installPath, 'QtFramework');
  if (!fs.existsSync(frameworkDir)) {
    return false;
  }
  try {
    const entries = fs.readdirSync(frameworkDir, { withFileTypes: true });
    return entries.some((e) => e.isDirectory());
  } catch {
    return false;
  }
}

let diskWatchers: vscode.FileSystemWatcher[] = [];

/**
 * Watch the Qt framework installation directory on disk and invoke `onChange`
 * whenever a version folder is added or removed — e.g. an install/uninstall
 * done outside the extension, or a manual change. The watcher re-targets
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

    const config = vscode.workspace.getConfiguration(EXTENSION_ID);
    const rawPath = config.get<string>(CONF_INSTALLATION_PATH);
    if (!rawPath) {
      return;
    }
    const installRoot = resolveConfiguration(rawPath);

    // Ignore disk churn while an install is writing into the folder — the
    // intermediate states are noise. The install flow refreshes the
    // walkthrough itself once it completes.
    const handle = () => {
      if (isInstalling()) {
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

    // Non-recursive watch of the immediate children (the version folders),
    // which is exactly what isAnyVersionInstalledOnDisk() looks at.
    addWatcher(path.join(installRoot, 'QtFramework'), '*');

    // The watcher above is anchored inside the installation root, so it cannot
    // observe the root itself being removed. Deleting the installation root
    // wipes QtFramework along with it, which must also refresh the walkthrough.
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

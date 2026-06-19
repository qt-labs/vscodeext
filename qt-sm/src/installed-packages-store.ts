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

let diskWatcher: vscode.FileSystemWatcher | undefined;

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
    diskWatcher?.dispose();
    diskWatcher = undefined;

    const config = vscode.workspace.getConfiguration(EXTENSION_ID);
    const rawPath = config.get<string>(CONF_INSTALLATION_PATH);
    if (!rawPath) {
      return;
    }
    const frameworkDir = path.join(
      resolveConfiguration(rawPath),
      'QtFramework'
    );
    // Non-recursive watch of the immediate children (the version folders),
    // which is exactly what isAnyVersionInstalledOnDisk() looks at.
    const pattern = new vscode.RelativePattern(
      vscode.Uri.file(frameworkDir),
      '*'
    );
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    // Ignore disk churn while an install is writing into the folder — the
    // intermediate states are noise. The install flow refreshes the
    // walkthrough itself once it completes.
    const handle = () => {
      if (isInstalling()) {
        return;
      }
      onChange();
    };
    watcher.onDidCreate(handle);
    watcher.onDidDelete(handle);
    diskWatcher = watcher;
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
        diskWatcher?.dispose();
      }
    }
  );
}

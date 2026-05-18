// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import {
  BaseStateManager,
  CoreKey,
  createLogger,
  resolveConfiguration
} from 'qt-lib';
import { EXTENSION_ID, CONF_INSTALLATION_PATH } from '@/constants';

export interface InstalledPackageEntry {
  id: string;
  version: string;
  installedAt: string;
}

const logger = createLogger('installed-packages-store');

export class InstalledPackagesState extends BaseStateManager {
  constructor(context: vscode.ExtensionContext) {
    super(context, CoreKey.GLOBAL_WORKSPACE);
  }

  getInstalledPackages(): InstalledPackageEntry[] {
    return this._get<InstalledPackageEntry[]>('installedPackages', []);
  }

  isPackageInstalled(id: string, version: string): boolean {
    return this.getInstalledPackages().some(
      (entry) => entry.id === id && entry.version === version
    );
  }

  markPackageInstalled(id: string, version: string): Thenable<void> {
    const entries = this.getInstalledPackages();
    if (entries.some((e) => e.id === id && e.version === version)) {
      return Promise.resolve();
    }
    entries.push({ id, version, installedAt: new Date().toISOString() });
    return this._update('installedPackages', entries);
  }
}

let stateInstance: InstalledPackagesState | undefined;

export function initInstalledPackagesStore(
  context: vscode.ExtensionContext
): void {
  stateInstance = new InstalledPackagesState(context);
}

export function getInstalledPackagesState():
  | InstalledPackagesState
  | undefined {
  return stateInstance;
}

export function getInstalledPackages(): InstalledPackageEntry[] {
  return stateInstance?.getInstalledPackages() ?? [];
}

export function markPackageInstalled(
  id: string,
  version: string
): Thenable<void> {
  return stateInstance?.markPackageInstalled(id, version) ?? Promise.resolve();
}

const installedVersionsOnDisk = new Set<string>();

/**
 * Scan the installation path on disk for installed Qt versions.
 * Folder structure: <installationPath>/QtFramework/<version>/
 */
export function scanInstallationPath(): void {
  const config = vscode.workspace.getConfiguration(EXTENSION_ID);
  const rawPath = config.get<string>(CONF_INSTALLATION_PATH);
  if (!rawPath) {
    return;
  }
  const installPath = resolveConfiguration(rawPath);
  const qtFrameworkDir = path.join(installPath, 'QtFramework');

  if (!fs.existsSync(qtFrameworkDir)) {
    logger.info(`QtFramework directory not found at ${qtFrameworkDir}`);
    return;
  }

  let entries: string[];
  try {
    entries = fs.readdirSync(qtFrameworkDir);
  } catch {
    logger.warn(`Failed to read QtFramework directory: ${qtFrameworkDir}`);
    return;
  }

  const versionPattern = /^\d+\.\d+\.\d+$/;
  for (const entry of entries) {
    if (!versionPattern.test(entry)) {
      continue;
    }
    const fullPath = path.join(qtFrameworkDir, entry);
    if (fs.statSync(fullPath).isDirectory()) {
      installedVersionsOnDisk.add(entry);
      logger.info(`Found installed Qt version on disk: ${entry}`);
    }
  }
}

export function isVersionInstalledOnDisk(version: string): boolean {
  return installedVersionsOnDisk.has(version);
}

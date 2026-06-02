// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { resolveConfiguration } from 'qt-lib';
import { EXTENSION_ID, CONF_INSTALLATION_PATH } from '@/constants';

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

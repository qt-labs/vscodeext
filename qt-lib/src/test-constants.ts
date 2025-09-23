// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import * as fs from 'fs';

interface RootPackage {
  version: string;
}

function getExtensionVersion(extensionRoot: string): string {
  const packageJsonPath = path.join(extensionRoot, 'package.json');
  const packageJson = JSON.parse(
    fs.readFileSync(packageJsonPath, 'utf-8')
  ) as RootPackage;
  return packageJson.version;
}

export function getLocalQtCore(): string {
  const qtcoreExtensionRoot = '../../../qt-core';
  const packageVersion = getExtensionVersion(qtcoreExtensionRoot);
  if (!packageVersion) {
    throw new Error('Failed to get package version');
  }
  return `../../../qt-core/out/qt-core-${packageVersion}.vsix`;
}
/**
 * Returns additional CLI args to quiet VS Code test runs.
 *
 * Uses process.env.VSCODE_LOG_LEVEL if set (default: "error").
 */
export function getQuietVSCodeArgs(): string[] {
  return [
    '--log',
    process.env.VSCODE_LOG_LEVEL ?? 'error',
    '--disable-telemetry',
    '--skip-welcome',
    '--skip-release-notes',
    '--disable-updates'
  ];
}

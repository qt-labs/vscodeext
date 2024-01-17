// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

/**
 * Returns true if the extension is currently running tests.
 */
export function isTestMode(): boolean {
  return process.env.QT_TESTING === '1';
}

export function mangleQtInstallation(installation: string): string {
  const pathParts = installation.split(/[/\\:]+/).filter((n) => n);
  const qtIdx = Math.max(
    0,
    pathParts.findIndex((s) => s.toLowerCase() == 'qt')
  );
  return pathParts.slice(qtIdx).join('-');
}

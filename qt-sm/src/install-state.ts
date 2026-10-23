// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

/**
 * Ephemeral (runtime-only) flag tracking whether a package installation is
 * currently in progress. Used to:
 *  - restrict to a single installation at a time, and
 *  - suppress installation-root disk-watcher events while an install writes
 *    files into the folder (those intermediate changes should be ignored).
 *
 * Deliberately NOT persisted: it must reset to false on reload/crash, since a
 * stale "true" would permanently block installs and freeze the walkthrough.
 */
let installing = false;

export function isInstalling(): boolean {
  return installing;
}

export function setInstalling(value: boolean): void {
  installing = value;
}

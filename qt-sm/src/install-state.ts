// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

/**
 * Ephemeral (runtime-only) flag tracking whether a package operation, an
 * installation or a removal, is currently in progress. Used to:
 *  - run a single package operation at a time, as the service expects, and
 *  - suppress installation-root disk-watcher events while the operation
 *    writes or deletes files in the folder (those intermediate changes
 *    should be ignored).
 *
 * Deliberately NOT persisted: it must reset to false on reload/crash, since a
 * stale "true" would permanently block installs and freeze the walkthrough.
 */
let running = false;

export function isPackageOperationRunning(): boolean {
  return running;
}

export function setPackageOperationRunning(value: boolean): void {
  running = value;
}

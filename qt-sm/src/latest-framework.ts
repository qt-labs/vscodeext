// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import type * as vscode from 'vscode';
import { Packages, InstallState, type PackageData } from 'sms-api';

import { createLogger, BaseStateManager, CoreKey } from 'qt-lib';
import { STATE_LATEST_FRAMEWORK_VERSION } from '@/constants';
import { getSession } from '@/service-connection';
import {
  isVersionInstalledOnDisk,
  newestPackages,
  searchInstallablePackages
} from '@/installed-packages-store';

const logger = createLogger('latest-framework');

const QT_FRAMEWORK_PRODUCT = 'qtframework';

/**
 * Persists the newest available Qt Framework version seen from the service, so
 * the "Get latest" gate can still be answered after a reload, before any
 * session has been connected.
 */
class LatestFrameworkStateManager extends BaseStateManager {
  constructor(context: vscode.ExtensionContext) {
    super(context, CoreKey.GLOBAL_WORKSPACE);
  }

  get latestVersion(): string | undefined {
    return this._get<string | undefined>(
      STATE_LATEST_FRAMEWORK_VERSION,
      undefined
    );
  }

  set latestVersion(value: string | undefined) {
    void this._update(STATE_LATEST_FRAMEWORK_VERSION, value);
  }
}

let latestFrameworkState: LatestFrameworkStateManager | undefined;

/**
 * Initialize the latest framework state. Call this from extension activation.
 */
export function initLatestFrameworkState(
  context: vscode.ExtensionContext
): void {
  latestFrameworkState = new LatestFrameworkStateManager(context);
}

/** Forget the persisted latest version. Used by resetTestState. */
export function resetLatestFrameworkState(): void {
  if (latestFrameworkState) {
    latestFrameworkState.latestVersion = undefined;
  }
}

/**
 * Pick the Qt Framework packages of the newest version from an
 * available-packages list and remember that version for later offline
 * checks. Windows offers a version once per compiler, so there can be
 * several: the build to install comes first, see newestPackages().
 */
export function findLatestFramework(
  available: readonly PackageData[]
): PackageData[] {
  const latest = newestPackages(
    available.filter((pkg: PackageData) => pkg.product === QT_FRAMEWORK_PRODUCT)
  );
  const version = latest[0]?.version;
  if (version !== undefined && latestFrameworkState) {
    latestFrameworkState.latestVersion = version;
  }
  return latest;
}

/**
 * Determine whether the newest available Qt Framework version is already
 * installed, in any of its builds: a user who has it for MinGW has the
 * latest version, and is not offered the MSVC build of it as "latest".
 *
 * "latest" is defined by the remote available-packages list, so answering this
 * accurately needs the SMS service. To avoid spawning the service or showing
 * progress UI just to compute a button's enabled state, the service is only
 * queried when a session is already connected. Otherwise the last known latest
 * version (persisted from a previous query) is checked against the disk.
 * Returns `undefined` when the answer is unknown, meaning "not installed" for
 * callers, so the install action stays enabled.
 */
export async function isLatestFrameworkInstalled(): Promise<
  boolean | undefined
> {
  const session = getSession();
  if (!session?.isConnected) {
    const cached = latestFrameworkState?.latestVersion;
    return cached ? isVersionInstalledOnDisk(cached) : undefined;
  }
  try {
    const available = await searchInstallablePackages(new Packages(session));
    const latest = findLatestFramework(available);
    const version = latest[0]?.version;
    if (version === undefined) {
      return undefined;
    }
    return (
      latest.some((pkg) => pkg.installState === InstallState.Installed) ||
      isVersionInstalledOnDisk(version)
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Failed to determine latest framework state: ${msg}`);
    return undefined;
  }
}

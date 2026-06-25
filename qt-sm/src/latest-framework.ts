// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { Packages, InstallState, type PackageData } from 'sms-api';

import { createLogger } from 'qt-lib';
import { getSession } from '@/service-connection';
import { isVersionInstalledOnDisk } from '@/installed-packages-store';

const logger = createLogger('latest-framework');

const QT_FRAMEWORK_PRODUCT = 'qtframework';

/**
 * Determine whether the newest available Qt Framework version is already
 * installed on disk.
 *
 * "latest" is defined by the remote available-packages list, so answering this
 * needs the SMS service. To avoid spawning the service or showing progress UI
 * just to compute a button's enabled state, this only runs when a session is
 * already connected; otherwise — and on any error — it returns `undefined`,
 * meaning "unknown". Callers should treat unknown as "not installed" so the
 * install action stays enabled.
 */
export async function isLatestFrameworkInstalled(): Promise<
  boolean | undefined
> {
  const session = getSession();
  if (!session?.isConnected) {
    return undefined;
  }
  try {
    const packages = new Packages(session);
    const available = await packages.searchAvailablePackages({
      packagePresentation: 'monolith'
    });
    const latest = available
      .filter((pkg: PackageData) => pkg.product === QT_FRAMEWORK_PRODUCT)
      .sort((a, b) =>
        b.version.localeCompare(a.version, undefined, {
          numeric: true,
          sensitivity: 'base'
        })
      )[0];
    if (!latest) {
      return undefined;
    }
    return (
      latest.installState === InstallState.Installed ||
      isVersionInstalledOnDisk(latest.version)
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Failed to determine latest framework state: ${msg}`);
    return undefined;
  }
}

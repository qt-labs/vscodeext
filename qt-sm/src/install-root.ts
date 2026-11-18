// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import type { InstallationTarget } from 'sms-api';

import { resolveConfiguration } from 'qt-lib';
import { EXTENSION_ID, CONF_INSTALLATION_PATH } from '@/constants';

/**
 * The configured installation root (`qt-sm.installationPath`), with `~`
 * and variables resolved, or undefined when the setting is empty.
 *
 * The service keeps no installation of its own: every request that works
 * on an installation names it, so this is the one place the extension
 * reads the root it works on.
 */
export function getInstallRoot(): string | undefined {
  const raw = vscode.workspace
    .getConfiguration(EXTENSION_ID)
    .get<string>(CONF_INSTALLATION_PATH);
  if (!raw) {
    return undefined;
  }
  const resolved = resolveConfiguration(raw);
  return resolved || undefined;
}

/**
 * The installation to name in a service request. Empty when no root is
 * configured: a search then reports every package as not installed, and
 * the requests that need an installation fail with error 9001.
 */
export function installationTarget(): InstallationTarget {
  const installRoot = getInstallRoot();
  return installRoot ? { installRoot } : {};
}

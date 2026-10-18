/* Copyright (C) 2026 The Qt Company Ltd.
 *
 * SPDX-License-Identifier: LicenseRef-Qt-Commercial OR GPL-3.0-only WITH Qt-GPL-exception-1.0
 */

/**
 * Locations of the settings files shared between the Qt tools. They mirror
 * the QStandardPaths based paths of the C++ service so that both sides read
 * and write the same files.
 */

import * as os from 'os';
import * as path from 'path';

/**
 * `QStandardPaths::GenericDataLocation`:
 *   Linux:   `$XDG_DATA_HOME` or `~/.local/share`
 *   macOS:   `~/Library/Application Support`
 *   Windows: `%APPDATA%` (`C:\Users\<user>\AppData\Roaming`)
 */
export function genericDataLocation(): string {
  if (process.platform === 'win32') {
    return process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support');
  }
  return (
    process.env.XDG_DATA_HOME ?? path.join(os.homedir(), '.local', 'share')
  );
}

/**
 * The organization level settings file `Qt.ini` that holds the OIDC tokens,
 * the account email and the personal access token.
 */
export function qtIniPath(): string {
  return path.join(genericDataLocation(), 'Qt', 'Qt.ini');
}

/**
 * The `QtCompany.ini` written by the bootstrap installer. The service binary
 * location (`serviceInstallPath`) is read from it.
 *   Linux:   `$HOME/.local/share/QtCompany/QtCompany.ini`
 *   macOS:   `$HOME/Library/Application Support/QtCompany/QtCompany.ini`
 *   Windows: `%LOCALAPPDATA%/QtCompany/QtCompany.ini`
 */
export function qtCompanyIniPath(): string {
  if (process.platform === 'win32') {
    const appData =
      process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local');
    return path.join(appData, 'QtCompany', 'QtCompany.ini');
  }
  if (process.platform === 'darwin') {
    return path.join(
      os.homedir(),
      'Library',
      'Application Support',
      'QtCompany',
      'QtCompany.ini'
    );
  }
  const dataDir =
    process.env.XDG_DATA_HOME ?? path.join(os.homedir(), '.local', 'share');
  return path.join(dataDir, 'QtCompany', 'QtCompany.ini');
}

/**
 * The `qtaccount.ini` of the retired email and password login. Nothing reads
 * it any more; it is only removed by "Reset Test State".
 */
export function legacyQtAccountIniPath(): string {
  if (process.platform === 'win32') {
    const appData =
      process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'Qt', 'qtaccount.ini');
  }
  const dataDir =
    process.env.XDG_DATA_HOME ?? path.join(os.homedir(), '.local', 'share');
  return path.join(dataDir, 'Qt', 'qtaccount.ini');
}

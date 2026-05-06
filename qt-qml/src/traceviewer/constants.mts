// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { IsMacOS } from 'qt-lib';
import { EXTENSION_ID } from '@/constants.js';

// Note
// official: <host>/official_releases/qtcreator/latest/installer_source;
// snapshot: <host>/snapshots/qtcreator/21.0/21.0.0-beta1/installer_source/latest
export const DOWNLOAD_HOST = 'https://download.qt.io';
export const DOWNLOAD_DIR_BASE =
  '/snapshots/qtcreator/21.0/21.0.0-beta1/installer_source/latest';
export const DOWNLOAD_CONTENT_TYPE = 'application/zip';
export const DOWNLOAD_FILE = IsMacOS
  ? 'qmltraceviewer-signed.zip'
  : 'qmltraceviewer.zip';

export const EXE_NAME = 'qmltraceviewer';
export const INSTALL_DIR_NAME = 'qmltraceviewer';
export const INSTALL_INFO_FILE = 'installation.json';
export const RELEASE_INFO_FILE = 'release.json';

export const CONF_SECTION = 'qt-qml.profiler';
export const CONF_CUSTOM_TRACE_VIEWER_EXE_PATH = 'customTraceViewerExePath';
export const COMMAND_DOWNLOAD_VIEWER = 'downloadQmlTraceViewer';
export const COMMAND_DOWNLOAD_VIEWER_FULL = `${EXTENSION_ID}.${COMMAND_DOWNLOAD_VIEWER}`;

export { EXTENSION_ID };

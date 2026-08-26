// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { IsLinux, IsMacOS, IsWindows } from 'qt-lib';
import { EXTENSION_ID } from '@/constants.js';

// Note
// official: <host>/official_releases/qtcreator/latest/installer_source;
// snapshot: <host>/snapshots/qtcreator/<ver>/<ver-full>/installer_source/latest
export const DOWNLOAD_HOST = 'https://download.qt.io';
export const DOWNLOAD_DIR_BASE =
  '/official_releases/qtcreator/latest/installer_source';
export const DOWNLOAD_CONTENT_TYPE = 'application/zip';

export interface PackageCandidate {
  // package file name below <download-dir>/<os>_<arch>/
  file: string;
  // executable path relative to the extracted package
  exeRelPath: string;
}

// The tool was renamed from "qmltraceviewer" (up to Qt Creator 20) to
// "qtprofiler" (Qt Creator 21 and later), which renamed both the package
// and the executable inside it. Candidates are tried in order, newest name
// first, so the download keeps working with whichever release "latest"
// serves. Drop the old name once Qt Creator 21 is the oldest release here.
export const PACKAGE_CANDIDATES: PackageCandidate[] = IsMacOS
  ? [
      {
        file: 'qtprofiler-signed.zip',
        exeRelPath: 'Qt Profiler.app/Contents/MacOS/Qt Profiler'
      },
      {
        file: 'qmltraceviewer-signed.zip',
        exeRelPath: 'qmltraceviewer.app/Contents/MacOS/qmltraceviewer'
      }
    ]
  : IsWindows
    ? [
        { file: 'qtprofiler.zip', exeRelPath: 'bin\\qtprofiler.exe' },
        { file: 'qmltraceviewer.zip', exeRelPath: 'bin\\qmltraceviewer.exe' }
      ]
    : IsLinux
      ? [
          {
            file: 'qtprofiler.zip',
            exeRelPath: 'libexec/qtcreator/qtprofiler'
          },
          {
            file: 'qmltraceviewer.zip',
            exeRelPath: 'libexec/qtcreator/qmltraceviewer'
          }
        ]
      : [];

export const INSTALL_DIR_NAME = 'qmltraceviewer';
export const INSTALL_INFO_FILE = 'installation.json';
export const RELEASE_INFO_FILE = 'release.json';

export const CONF_SECTION = 'qt-qml.profiler';
export const CONF_CUSTOM_TRACE_VIEWER_EXE_PATH = 'customTraceViewerExePath';
export const COMMAND_DOWNLOAD_VIEWER = 'downloadQmlTraceViewer';
export const COMMAND_DOWNLOAD_VIEWER_FULL = `${EXTENSION_ID}.${COMMAND_DOWNLOAD_VIEWER}`;

export { EXTENSION_ID };

// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

export const QtInsRootConfigName = 'qtInstallationRoot';
export const AdditionalQtPathsName = 'additionalQtPaths';
export const CORE_EXTENSION_ID = 'qt-core';

export const CoreKey = {
  ADDITIONAL_QT_PATHS: 'additionalQtPaths',
  QT_INSTALLATION_ROOT: 'qtInstallationRoot',
  PYSIDE_ENV_DATA: 'pysideEnvData',
  WORKSPACE_FEATURES: 'workspaceFeatures',
  SELECTED_QT_PATHS: 'selectedQtPaths',
  BUILD_DIR: 'buildDir',
  QT_TOOLS_PATHS: 'qtToolsPaths',
  GLOBAL_WORKSPACE: 'global'
};

export const QT_EXTENSION_PUBLISHER = 'theqtcompany';

export interface QtExtensionInfo {
  // Extension name without the publisher prefix, e.g. 'qt-core'
  name: string;
  displayName: string;
}

export const QtExtensions: readonly QtExtensionInfo[] = [
  { name: 'qt-core', displayName: 'Qt Core' },
  { name: 'qt-cpp', displayName: 'Qt C++' },
  { name: 'qt-qml', displayName: 'Qt QML' },
  { name: 'qt-ui', displayName: 'Qt UI (Deprecated)' },
  { name: 'qt-python', displayName: 'Qt Python' },
  { name: 'qt-csharp', displayName: 'Qt Bridge C#' }
];

export function getQtExtensionFullId(name: string) {
  return `${QT_EXTENSION_PUBLISHER}.${name}`;
}

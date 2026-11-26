// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import {
  createLogger,
  host,
  CoreKey,
  QtWorkspaceConfigMessage,
  type QtToolsPaths
} from 'qt-lib';
import { EXTENSION_ID, CONF_INSTALLATION_PATH } from '@/constants';
import { getInstallRoot } from '@/install-root';
import {
  CMAKE,
  MINGW,
  NINJA,
  listProductVersions,
  productDir,
  productVersionDir
} from '@/install-layout';
import { isPackageOperationRunning } from '@/install-state';
import { coreAPI } from '@/extension';

const logger = createLogger('qt-tools-store');

function firstExisting(candidates: string[]): string | undefined {
  return candidates.find((c) => fs.existsSync(c));
}

/**
 * Locate the CMake executable of the newest CMake version installed in
 * `installRoot`. The layout below the version folder differs per platform:
 *   - macOS:   CMake.app/Contents/bin/cmake
 *   - Linux:   bin/cmake
 *   - Windows: bin/cmake.exe
 */
function findCMake(installRoot: string): string | undefined {
  for (const version of listProductVersions(installRoot, CMAKE)) {
    const versionDir = productVersionDir(installRoot, CMAKE, version);
    const candidates: string[] = [];
    if (host.isMacOS) {
      candidates.push(
        path.join(versionDir, 'CMake.app', 'Contents', 'bin', 'cmake')
      );
    }
    // Generic bin/ layout (Linux/Windows, and a fallback everywhere).
    candidates.push(path.join(versionDir, 'bin', `cmake${host.exeSuffix}`));
    const cmake = firstExisting(candidates);
    if (cmake) {
      return cmake;
    }
  }
  return undefined;
}

/**
 * Locate the Ninja executable of the newest Ninja version installed in
 * `installRoot`. It sits in the version folder on every platform, only the
 * executable suffix differs on Windows.
 */
function findNinja(installRoot: string): string | undefined {
  for (const version of listProductVersions(installRoot, NINJA)) {
    const ninja = path.join(
      productVersionDir(installRoot, NINJA, version),
      `ninja${host.exeSuffix}`
    );
    if (fs.existsSync(ninja)) {
      return ninja;
    }
  }
  return undefined;
}

/**
 * Locate the `bin` folder of every MinGW version installed in `installRoot`,
 * by version. All of them are reported and not only the newest, because a
 * MinGW build of Qt is built against with the MinGW version it names.
 */
function findMingw(installRoot: string): Record<string, string> {
  const binDirs: Record<string, string> = {};
  for (const version of listProductVersions(installRoot, MINGW)) {
    const binDir = path.join(
      productVersionDir(installRoot, MINGW, version),
      'bin'
    );
    if (fs.existsSync(path.join(binDir, `g++${host.exeSuffix}`))) {
      binDirs[version] = binDir;
    }
  }
  return binDirs;
}

/**
 * Detect the CMake and Ninja executables and the MinGW toolchains installed
 * in the current installation root, see install-layout.ts for where. Fields
 * are omitted when the corresponding tool is not present.
 */
export function detectQtToolsPaths(): QtToolsPaths {
  const installRoot = getInstallRoot();
  if (!installRoot) {
    return {};
  }
  const result: QtToolsPaths = {};
  const cmake = findCMake(installRoot);
  if (cmake) {
    result.cmake = cmake;
  }
  const ninja = findNinja(installRoot);
  if (ninja) {
    result.ninja = ninja;
  }
  const mingw = findMingw(installRoot);
  if (Object.keys(mingw).length > 0) {
    result.mingw = mingw;
  }
  return result;
}

/**
 * Detect the bundled build tools and publish them to qt-core/qt-cpp via
 * CoreAPI under `CoreKey.QT_TOOLS_PATHS`. Safe to call repeatedly; it always
 * reflects the current on-disk state.
 */
export function publishQtToolsPaths(): void {
  if (!coreAPI) {
    logger.warn('CoreAPI unavailable, cannot publish Qt tools paths');
    return;
  }
  const paths = detectQtToolsPaths();
  coreAPI.setValue(CoreKey.GLOBAL_WORKSPACE, CoreKey.QT_TOOLS_PATHS, paths);
  const message = new QtWorkspaceConfigMessage(CoreKey.GLOBAL_WORKSPACE);
  message.config.add(CoreKey.QT_TOOLS_PATHS);
  logger.info(
    `Publishing Qt tools paths: cmake=${paths.cmake ?? '<none>'}, ` +
      `ninja=${paths.ninja ?? '<none>'}, ` +
      `mingw=${Object.values(paths.mingw ?? {}).join(', ') || '<none>'}`
  );
  coreAPI.notify(message);
}

let toolsWatchers: vscode.FileSystemWatcher[] = [];

function disposeToolsWatchers(): void {
  toolsWatchers.forEach((w) => {
    w.dispose();
  });
  toolsWatchers = [];
}

/**
 * Watch the CMake, Ninja and MinGW folders of the installation root and
 * re-publish the tool paths whenever a version of them is added or removed — e.g.
 * installed/uninstalled by QtCreator while qt-sm is running. The watchers
 * re-target automatically when the installation-root setting changes.
 */
export function watchQtToolsOnDisk(
  context: vscode.ExtensionContext,
  onChange: () => void
): void {
  const retarget = () => {
    disposeToolsWatchers();

    const installRoot = getInstallRoot();
    if (!installRoot) {
      return;
    }
    const handle = () => {
      // qt-sm's own installs and removals publish explicitly once finished;
      // ignore the intermediate disk churn they produce.
      if (isPackageOperationRunning()) {
        return;
      }
      onChange();
    };
    // Watch the immediate children of each tool folder (its version
    // folders). Adding or removing a tool creates/deletes one here, which
    // is enough to trigger a re-detect.
    for (const tool of [CMAKE, NINJA, MINGW]) {
      const pattern = new vscode.RelativePattern(
        vscode.Uri.file(productDir(installRoot, tool)),
        '*'
      );
      const watcher = vscode.workspace.createFileSystemWatcher(pattern);
      watcher.onDidCreate(handle);
      watcher.onDidDelete(handle);
      toolsWatchers.push(watcher);
    }
  };

  retarget();

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(`${EXTENSION_ID}.${CONF_INSTALLATION_PATH}`)) {
        retarget();
      }
    }),
    { dispose: disposeToolsWatchers }
  );
}

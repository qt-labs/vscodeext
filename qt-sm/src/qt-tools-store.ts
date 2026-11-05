// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import {
  createLogger,
  resolveConfiguration,
  IsMacOS,
  OSExeSuffix,
  CoreKey,
  QtWorkspaceConfigMessage,
  type QtToolsPaths
} from 'qt-lib';
import { EXTENSION_ID, CONF_INSTALLATION_PATH } from '@/constants';
import { isInstalling } from '@/install-state';
import { coreAPI } from '@/extension';

const logger = createLogger('qt-tools-store');

/**
 * Absolute path to the `Tools/` directory under the configured installation
 * root, or undefined when no installation path is set.
 */
function toolsDir(): string | undefined {
  const config = vscode.workspace.getConfiguration(EXTENSION_ID);
  const rawPath = config.get<string>(CONF_INSTALLATION_PATH);
  if (!rawPath) {
    return undefined;
  }
  const root = resolveConfiguration(rawPath);
  if (!root) {
    return undefined;
  }
  return path.join(root, 'Tools');
}

function firstExisting(candidates: string[]): string | undefined {
  return candidates.find((c) => fs.existsSync(c));
}

/**
 * Locate the CMake executable bundled under `<root>/Tools/CMake`. The layout
 * differs per platform:
 *   - macOS:   Tools/CMake/CMake.app/Contents/bin/cmake
 *   - Linux:   Tools/CMake/bin/cmake
 *   - Windows: Tools/CMake/bin/cmake.exe
 */
function findCMake(tools: string): string | undefined {
  const cmakeRoot = path.join(tools, 'CMake');
  const candidates: string[] = [];
  if (IsMacOS) {
    candidates.push(
      path.join(cmakeRoot, 'CMake.app', 'Contents', 'bin', 'cmake')
    );
  }
  // Generic bin/ layout (Linux/Windows, and a fallback everywhere).
  candidates.push(path.join(cmakeRoot, 'bin', `cmake${OSExeSuffix}`));
  return firstExisting(candidates);
}

/**
 * Locate the Ninja executable bundled under `<root>/Tools/Ninja`. Same layout
 * on every platform, only the executable suffix differs on Windows.
 */
function findNinja(tools: string): string | undefined {
  return firstExisting([path.join(tools, 'Ninja', `ninja${OSExeSuffix}`)]);
}

/**
 * Detect the CMake and Ninja executables installed under the current
 * installation root's `Tools/` directory. Fields are omitted when the
 * corresponding tool is not present.
 */
export function detectQtToolsPaths(): QtToolsPaths {
  const tools = toolsDir();
  if (!tools || !fs.existsSync(tools)) {
    return {};
  }
  const result: QtToolsPaths = {};
  const cmake = findCMake(tools);
  if (cmake) {
    result.cmake = cmake;
  }
  const ninja = findNinja(tools);
  if (ninja) {
    result.ninja = ninja;
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
      `ninja=${paths.ninja ?? '<none>'}`
  );
  coreAPI.notify(message);
}

let toolsWatcher: vscode.FileSystemWatcher | undefined;

/**
 * Watch the `Tools/` directory under the installation root and re-publish the
 * tool paths whenever a tool folder is added or removed — e.g. CMake or Ninja
 * installed/uninstalled by QtCreator while qt-sm is running. The watcher
 * re-targets automatically when the installation-root setting changes.
 */
export function watchQtToolsOnDisk(
  context: vscode.ExtensionContext,
  onChange: () => void
): void {
  const retarget = () => {
    toolsWatcher?.dispose();
    toolsWatcher = undefined;

    const tools = toolsDir();
    if (!tools) {
      return;
    }
    // Watch the immediate children of Tools/ (the per-tool folders such as
    // CMake and Ninja). Adding or removing a tool creates/deletes its folder
    // here, which is enough to trigger a re-detect.
    const pattern = new vscode.RelativePattern(vscode.Uri.file(tools), '*');
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    const handle = () => {
      // qt-sm's own installs publish explicitly once finished; ignore the
      // intermediate disk churn they produce.
      if (isInstalling()) {
        return;
      }
      onChange();
    };
    watcher.onDidCreate(handle);
    watcher.onDidDelete(handle);
    toolsWatcher = watcher;
  };

  retarget();

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(`${EXTENSION_ID}.${CONF_INSTALLATION_PATH}`)) {
        retarget();
      }
    }),
    {
      dispose: () => {
        toolsWatcher?.dispose();
      }
    }
  );
}

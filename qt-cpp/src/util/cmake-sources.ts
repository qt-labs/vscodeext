// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import * as fs from 'fs';

// Mirrors the nested CMakeLists.txt scan of CMake Tools for
// cmake.autoDetectSourceDirectory: the scan depth and the skipped folders.
const NESTED_SCAN_MAX_DEPTH = 3;
const NESTED_SCAN_EXCLUDED_DIRS = new Set([
  '.git',
  '.hg',
  '.svn',
  '.vs',
  '.vscode',
  '.cache',
  'build',
  'builds',
  'out',
  'bin',
  'obj',
  'dist',
  'node_modules',
  'cmakefiles',
  '_deps',
  'vcpkg_installed',
  'vendor',
  'third_party',
  'thirdparty',
  'external',
  'externals',
  'submodules'
]);

function hasNestedCMakeLists(dir: string, depth: number): boolean {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return false;
  }
  if (
    depth > 0 &&
    entries.some((entry) => entry.name.toLowerCase() === 'cmakelists.txt')
  ) {
    return true;
  }
  if (depth >= NESTED_SCAN_MAX_DEPTH) {
    return false;
  }
  return entries.some(
    (entry) =>
      entry.isDirectory() &&
      !NESTED_SCAN_EXCLUDED_DIRS.has(entry.name.toLowerCase()) &&
      hasNestedCMakeLists(path.join(dir, entry.name), depth + 1)
  );
}

/**
 * Whether a workspace folder contains CMake sources.
 *
 * `sourceDirectory` is the explicitly configured `cmake.sourceDirectory`, or
 * undefined if it is not set. Directories with variables other than the
 * workspace folder ones cannot be resolved here and count as CMake sources.
 * Without a configured directory, CMake Tools uses the folder itself, or,
 * with `autoDetect`, a CMakeLists.txt in a subdirectory.
 */
export function hasCMakeSources(
  folderPath: string,
  sourceDirectory: string | string[] | undefined,
  autoDetect = true
) {
  const sourceDirectories = (
    Array.isArray(sourceDirectory) ? sourceDirectory : [sourceDirectory]
  ).filter((dir): dir is string => !!dir?.trim());
  if (sourceDirectories.length === 0) {
    return (
      fs.existsSync(path.join(folderPath, 'CMakeLists.txt')) ||
      (autoDetect && hasNestedCMakeLists(folderPath, 0))
    );
  }
  const variables: Record<string, string> = {
    workspaceFolder: folderPath,
    workspaceRoot: folderPath,
    workspaceFolderBasename: path.basename(folderPath)
  };
  return sourceDirectories.some((dir) => {
    const resolved = dir.replace(
      /\$\{(\w+)\}/g,
      (match, name: string) => variables[name] ?? match
    );
    if (resolved.includes('${')) {
      return true;
    }
    return fs.existsSync(
      path.join(path.resolve(folderPath, resolved), 'CMakeLists.txt')
    );
  });
}

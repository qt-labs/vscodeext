// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

export const Home = os.homedir();
export const IsWindows = process.platform === 'win32';
export const PlatformExecutableExtension = IsWindows ? '.exe' : '';
export const UserLocalDir = IsWindows
  ? process.env['LOCALAPPDATA']!
  : path.join(Home, '.local/share');

export function matchesVersionPattern(path: string): boolean {
  // Check if the first character of the path is a digit (0-9)
  return /^([0-9]+\.)+/.test(path);
}

// Function to recursively search a directory for Qt installations
export async function findQtInstallations(dir: string): Promise<string[]> {
  const qtInstallations: string[] = [];
  const items = await fs.readdir(dir, { withFileTypes: true });
  for (const item of items) {
    if (item.isDirectory() && matchesVersionPattern(item.name)) {
      const installationItemPath = path.join(dir, item.name);
      const installationItemDirContent = await fs.readdir(
        installationItemPath,
        { withFileTypes: true }
      );
      for (const subitem of installationItemDirContent) {
        if (subitem.isDirectory() && subitem.name.toLowerCase() != 'src') {
          const subdirFullPath = path.join(installationItemPath, subitem.name);
          const qtConfPath = path.join(subdirFullPath, 'bin', 'qt.conf');
          try {
            await fs.access(qtConfPath).then(() => {
              qtInstallations.push(subdirFullPath);
            });
          } catch (err) {
            console.log(err);
          }
        }
      }
    }
  }
  return qtInstallations;
}

export async function findFilesInDir(
  startPath: string,
  filterExtension: string
): Promise<string[]> {
  const stat = await fs.stat(startPath);
  if (!stat.isDirectory()) {
    console.log('No directory:', startPath);
    return [];
  }

  const results: string[] = [];

  async function walkDir(currentPath: string): Promise<void> {
    const files = await fs.readdir(currentPath, { withFileTypes: true });
    for (let i = 0; i < files.length; i++) {
      if (files[i].isDirectory()) {
        await walkDir(files[i].path);
      } else if (path.extname(files[i].path) === filterExtension) {
        results.push(files[i].path);
      }
    }
  }

  await walkDir(startPath);
  return results;
}

export async function pathOfDirectoryIfExists(
  dirPath: string
): Promise<string | undefined> {
  try {
    await fs.access(dirPath);
    return path.normalize(dirPath);
  } catch (error) {
    return undefined;
  }
}

export function qtToolsDirByQtRootDir(qtRootDir: string) {
  return path.normalize(path.join(qtRootDir, 'Tools'));
}

export async function findFilesInWorkspace(
  filterExtension: string
): Promise<string[]> {
  // Get list of all the files in the workspace folders recursively
  let files: string[] = [];
  // Create an array to hold the promises
  const promises = [];
  for (const workspaceFolder of vscode.workspace.workspaceFolders || []) {
    // Define the search pattern
    const pattern = new vscode.RelativePattern(
      workspaceFolder,
      filterExtension
    );

    // Use findFiles to search for .pro files
    promises.push(
      vscode.workspace.findFiles(pattern, null).then((matches) => {
        files = files.concat(
          matches.map((uri) => {
            return uri.path;
          })
        );
      })
    );
  }
  await Promise.all(promises);
  return files;
}

export function mangleQtInstallation(installation: string): string {
  const pathParts = installation.split(/[/\\:]+/).filter((n) => n);
  const qtIdx = Math.max(
    0,
    pathParts.findIndex((s) => s.toLowerCase() == 'qt')
  );
  return pathParts.slice(qtIdx).join('-');
}

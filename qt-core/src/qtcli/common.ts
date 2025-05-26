// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as os from 'os';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { spawnSync } from 'child_process';

import { createLogger, isError, OSExeSuffix } from 'qt-lib';

export enum QtcliAction {
  ServerControl
}

export const qtcliSubCommands: Record<QtcliAction, string> = {
  [QtcliAction.ServerControl]: 'server'
};

export const qtcliExeName = 'qtcli' + OSExeSuffix;
export const logger = createLogger('qtcli');

export function errorString<T>(e: T) {
  return isError(e) ? e.message : String(e);
}

export function isValidQtcliPath(qtcliPath: string): boolean {
  const res = spawnSync(qtcliPath, ['--help'], {
    timeout: 1000
  });

  return res.status === 0;
}

export function isValidNewName(name: string): boolean {
  const o = name.trim();
  if (o.length === 0) {
    return false;
  }

  const regex = /^[a-zA-Z0-9-_]+$/;
  return regex.test(o);
}

export function fallbackWorkingDir(): string {
  const docs = path.join(os.homedir(), 'Documents');
  const settings =
    vscode.workspace
      .getConfiguration('files')
      .get<string>('dialog.defaultPath') ?? '';

  try {
    const o = settings.trim();
    if (fsSync.statSync(o).isDirectory()) {
      return o;
    }
  } catch (e) {
    return docs;
  }

  return docs;
}

export async function openUri(uri: vscode.Uri) {
  try {
    const stats = await fs.stat(uri.fsPath);

    if (stats.isFile()) {
      void vscode.commands.executeCommand('vscode.open', uri);
      return;
    }

    if (stats.isDirectory()) {
      vscode.workspace.updateWorkspaceFolders(
        vscode.workspace.workspaceFolders?.length ?? 0,
        null,
        { uri }
      );

      const fileToOpen = await findPrimaryFileUnder(uri.fsPath);
      if (fileToOpen) {
        void vscode.commands.executeCommand(
          'vscode.open',
          vscode.Uri.file(fileToOpen)
        );
      }
    }
  } catch (e) {
    logger.warn('cannot open:', uri.fsPath);
  }
}

export async function openFilesUnder(baseDir: string, names: string[]) {
  for (const name of names) {
    await openUri(vscode.Uri.file(path.join(baseDir, name)));
  }
}

export async function findPrimaryFileUnder(dir: string) {
  try {
    const patterns = [/Main.qml$/i, /main\.cpp$/i, /CMakeLists.txt$/];
    const files = await fs.readdir(dir);

    for (const pattern of patterns) {
      for (const file of files) {
        const filePath = path.join(dir, file);
        if (pattern.test(file)) {
          return filePath;
        }
      }
    }
  } catch (e) {
    return undefined;
  }

  return undefined;
}

export function findActiveTabUri(): vscode.Uri | undefined {
  const tab = vscode.window.tabGroups.activeTabGroup.activeTab;
  const input = tab?.input;

  if (input instanceof vscode.TabInputText) {
    return input.uri;
  } else if (input instanceof vscode.TabInputCustom) {
    // handle the case when a custom editor is used. (e.g. .qrc)
    return input.uri;
  }

  return undefined;
}

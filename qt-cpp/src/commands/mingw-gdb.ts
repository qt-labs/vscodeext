// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { IsWindows, telemetry } from 'qt-lib';
import { getQtInsRoot, getSelectedKit } from '@cmd/register-qt-path';
import { EXTENSION_ID } from '@/constants';

async function findMinGWgdbPath(): Promise<string | undefined> {
  telemetry.sendAction('minGWgdb');
  if (!IsWindows) {
    throw new Error('MinGW gdb is only available on Windows');
  }
  const kit = await getSelectedKit();
  if (!kit) {
    return undefined;
  }
  const insRoot = getQtInsRoot(kit);
  if (!insRoot) {
    const message = `Cannot find VSCODE_QT_INSTALLATION in the selected kit: ${kit.name}`;
    void vscode.window.showErrorMessage(message);
    return undefined;
  }
  const selectedQtPath = insRoot;
  const toolsDir = locateToolsDir(selectedQtPath);
  const mingwDir = fs
    .readdirSync(toolsDir)
    .find((tool) => tool.startsWith('mingw'));
  if (!mingwDir) {
    throw new Error('No MinGW installation found');
  }
  const gdbPath = path.join(toolsDir, mingwDir, 'bin', 'gdb.exe');
  if (!fs.existsSync(gdbPath)) {
    throw new Error('No gdb found in MinGW installation');
  }
  return gdbPath;
}

function locateToolsDir(selectedQtPath: string): string {
  let toolsDir = '';
  for (let i = 0; i < 4; i++) {
    toolsDir = path.join(selectedQtPath, '../'.repeat(i), 'Tools');
    if (fs.existsSync(toolsDir)) {
      return toolsDir;
    }
  }
  throw new Error(
    'No Tools directory found in the up to 4 levels up from the selected Qt path'
  );
}

export function registerMinGWgdbCommand() {
  return vscode.commands.registerCommand(
    `${EXTENSION_ID}.minGWgdb`,
    findMinGWgdbPath
  );
}

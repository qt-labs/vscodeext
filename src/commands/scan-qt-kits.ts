// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { IsWindows } from '@/util/os';
import { kitManager } from '@/extension';

export function registerScanForQtKitsCommand() {
  return vscode.commands.registerCommand(
    'qt-official.scanForQtKits',
    async () => {
      if (IsWindows) {
        await vscode.commands.executeCommand('cmake.scanForKits');
      }
      await kitManager.checkForAllQtInstallations();
    }
  );
}

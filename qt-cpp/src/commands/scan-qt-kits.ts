// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { IsWindows } from 'qt-lib';
import { kitManager } from '@/extension';
import { EXTENSION_ID } from '@/constants';

export function registerScanForQtKitsCommand() {
  return vscode.commands.registerCommand(
    `${EXTENSION_ID}.scanForQtKits`,
    async () => {
      if (IsWindows) {
        await vscode.commands.executeCommand('cmake.scanForKits');
      }
      await kitManager.checkForAllQtInstallations();
    }
  );
}

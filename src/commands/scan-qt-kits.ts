// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { kitManager } from '@/extension';

export function registerScanForQtKitsCommand() {
  return vscode.commands.registerCommand(
    'vscode-qt-tools.scanForQtKits',
    async () => {
      await kitManager.checkForAllQtInstallations();
    }
  );
}

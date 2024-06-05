// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { qmlls } from '@/extension';

export function registerRestartQmllsCommand() {
  return vscode.commands.registerCommand(
    'qt-official.restartQmlls',
    async () => {
      await qmlls.restart();
    }
  );
}

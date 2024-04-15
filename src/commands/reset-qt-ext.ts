// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { setDoNotAskForDefaultQtFolder } from '@cmd/register-qt-path';
import { kitManager } from '@/extension';

export async function resetQtExt() {
  await kitManager.reset();
  await setDoNotAskForDefaultQtFolder(false);
}

export function registerResetQtExtCommand() {
  return vscode.commands.registerCommand(
    'vscode-qt-tools.resetQtExt',
    resetQtExt
  );
}

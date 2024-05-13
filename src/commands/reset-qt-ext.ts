// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { kitManager, qmlls } from '@/extension';

export async function resetQtExt() {
  await kitManager.reset();
  await qmlls.restart();
}

export function registerResetQtExtCommand() {
  return vscode.commands.registerCommand('qt-official.resetQtExt', resetQtExt);
}

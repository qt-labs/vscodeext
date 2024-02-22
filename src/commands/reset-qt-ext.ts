// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import { stateManager } from '../state';
import { setQtFolder } from './register-qt-path';

export async function resetQtExt() {
  await stateManager.reset();
  await setQtFolder('');
}

export function registerResetQtExtCommand() {
  return vscode.commands.registerCommand(
    'vscode-qt-tools.resetQtExt',
    resetQtExt
  );
}

// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { kitManager } from '@/extension';
import { EXTENSION_ID } from '@/constants';

export async function reset() {
  await kitManager.reset();
}

export function registerResetCommand() {
  return vscode.commands.registerCommand(`${EXTENSION_ID}.reset`, reset);
}

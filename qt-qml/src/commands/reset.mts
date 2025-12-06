// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { projectManager } from '@/extension.mjs';
import { EXTENSION_ID } from '@/constants.js';

function reset() {
  void projectManager.restartQmlls();
}

export function registerResetCommand() {
  return vscode.commands.registerCommand(`${EXTENSION_ID}.reset`, reset);
}

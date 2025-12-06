// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { telemetry } from 'qt-lib';
import { projectManager } from '@/extension.mjs';
import { EXTENSION_ID } from '@/constants.js';

export function registerRestartQmllsCommand() {
  return vscode.commands.registerCommand(`${EXTENSION_ID}.restartQmlls`, () => {
    telemetry.sendAction('restartQmlls');
    void projectManager.restartQmlls();
  });
}

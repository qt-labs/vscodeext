// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { EXTENSION_ID } from '@/constants';
import { compoundPort } from '@/tasks/acquire-port';

// This function is used when a compound launch is used. The main idea is to
// return the same port number for the first and second call.
export function registerDebugPort() {
  return vscode.commands.registerCommand(`${EXTENSION_ID}.debugPort`, () => {
    if (compoundPort === undefined) {
      void vscode.window.showErrorMessage(
        'Use "${command:qt-qml.debugPort}" with a compound launch and "preLaunchTask": "Qt: Acquire Port"'
      );
      return;
    }
    return compoundPort;
  });
}

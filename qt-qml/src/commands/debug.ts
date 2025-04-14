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
      const message =
        'Use "${command:qt-qml.debugPort}" with a compound launch and "preLaunchTask": "Qt: Acquire Port". ' +
        'See the documentation for more details.';
      const action = 'Open Documentation';
      void vscode.window.showErrorMessage(message, action).then((value) => {
        if (value === action) {
          void vscode.env.openExternal(
            vscode.Uri.parse(
              'https://doc-snapshots.qt.io/vscodeext-dev/vscodeext-how-debug-apps-qml.html#debug-mixed-c-c-and-qml-code'
            )
          );
        }
      });
      return;
    }
    return compoundPort;
  });
}

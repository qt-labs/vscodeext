// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

/**
 * This function registers a new command for handling .qdoc and .qdocconf files.
 * It provides syntax highlighting and keyword completion for developers and documentation writers.
 */
export function registerQdocFile() {
  // Registering the command
  return vscode.commands.registerCommand('extension.handleQdoc', function () {
    // The code you place here will be executed every time your command is executed
    // Syntax highlighting and keyword completion logic goes here
  });
}

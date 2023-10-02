// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only OR GPL-2.0-only OR GPL-3.0-only

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { registerQtCommand } from './commands/register-qt-path';
import { registerPickDefaultQtCommand } from './commands/pick-default-qt';
import { registerDetectQtCMakeProjectCommand } from './commands/detect-qt-cmake';
import { registerLoadAndBuildQtProjectCommand } from './commands/build-qt-pro';

import { registerProFile } from './commands/file-ext-pro';
import { registerQrcFile } from './commands/file-ext-qrc';
import { registerQdocFile } from './commands/file-ext-qdoc';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "vscode-qt-tools" is now active!'
  );

  // Add a new command that provides some functionality when a .pro file is opened
  const proFileDisposable = registerProFile();

  // Add a new command that provides some functionality when a .qrc file is opened
  const qrcFileDisposable = registerQrcFile();

  // Add a new command that provides some functionality when a .qdoc or .qdocconf file is opened
  const qdocFileDisposable = registerQdocFile();

  // Register the 'vscode-qt-tools.pickDefaultQt' command using the imported function
  registerPickDefaultQtCommand(context);

  // Register the 'vscode-qt-tools.registerQt' command using the imported function
  const registerQtDisposable = registerQtCommand();

  // Register the 'vscode-qt-tools.loadAndBuildQtProject' command
  const loadAndBuildQtProjectDisposable =
    registerLoadAndBuildQtProjectCommand();

  // Add a new command to detect if the opened project is a CMake project that uses Qt
  registerDetectQtCMakeProjectCommand(context);

  context.subscriptions.push(
    proFileDisposable,
    qrcFileDisposable,
    qdocFileDisposable,
    registerQtDisposable,
    loadAndBuildQtProjectDisposable
  );
}

// This method is called when your extension is deactivated
export function deactivate() {}

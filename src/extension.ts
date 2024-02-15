// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { performance } from 'perf_hooks';
import {
  checkForQtInstallationsUpdates,
  registerQtCommand
} from './commands/register-qt-path';
import { registerDetectQtCMakeProjectCommand } from './commands/detect-qt-cmake';
import { registerProFile } from './commands/file-ext-pro';
import { registerQrcFile } from './commands/file-ext-qrc';
import { registerQdocFile } from './commands/file-ext-qdoc';
import { registerUiFile } from './commands/file-ext-ui';
import { registerKitDirectoryCommand } from './commands/kit-directory';
import { registerMinGWgdbCommand } from './commands/mingw-gdb';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  const promiseActivateCMake = vscode.extensions
    .getExtension('ms-vscode.cmake-tools')
    ?.activate();
  const activateStart = performance.now();

  // Add a new command that provides some functionality when a .ui file is opened
  registerUiFile(context);

  // Register the 'vscode-qt-tools.registerQt' command using the imported function
  registerQtCommand(context);

  // Add a new command to detect if the opened project is a CMake project that uses Qt
  registerDetectQtCMakeProjectCommand(context);

  context.subscriptions.push(
    registerProFile(),
    registerQrcFile(),
    registerQdocFile(),
    registerKitDirectoryCommand(),
    registerMinGWgdbCommand()
  );

  void checkForQtInstallationsUpdates();

  const activateEnd = performance.now();
  const activationTime = activateEnd - activateStart;
  console.log(
    `Done activating plugin ${context.extension.id}, took ${activationTime}ms`
  );

  await promiseActivateCMake;
}

// This method is called when your extension is deactivated
export function deactivate() {
  console.log('Deactivating vscode-qt-tools');
}

// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only OR GPL-2.0-only OR GPL-3.0-only

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { registerQtCommand } from './commands/register-qt-path';
import { registerPickDefaultQtCommand } from './commands/pick-default-qt';
import { registerDetectQtCMakeProjectCommand } from './commands/detect-qt-cmake';
import { registerLoadAndBuildQtProjectCommand } from './commands/build-qt-pro';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "vscode-qt-tools" is now active!'
  );

  // Add a new command that provides some functionality when a .pro file is opened
  const proFileDisposable = vscode.workspace.onDidOpenTextDocument(
    (document) => {
      if (document.fileName.endsWith('.pro')) {
        // The code you place here will be executed every time a .pro file is opened
      }
    }
  );

  // Add a new command that provides some functionality when a .qrc file is opened
  const qrcFileDisposable = vscode.workspace.onDidOpenTextDocument(
    (document) => {
      if (document.fileName.toLowerCase().endsWith('.qrc')) {
        // The code you place here will be executed every time a .qrc file is opened
        // TODO : parse the .qrc file and provide IntelliSense for the resources
        console.log('.qrc file', document.fileName);
        vscode.languages.setTextDocumentLanguage(document, 'xml');
      }
    }
  );

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
    registerQtDisposable,
    loadAndBuildQtProjectDisposable
  );
}

// This method is called when your extension is deactivated
export function deactivate() {}

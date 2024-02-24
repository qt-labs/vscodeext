// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import { performance } from 'perf_hooks';
import {
  checkDefaultQtFolderPath,
  checkForQtInstallations,
  onQtFolderUpdated,
  registerQtCommand
} from './commands/register-qt-path';
import { initCMakeKits } from './commands/detect-qt-cmake';
import { registerProFile } from './commands/file-ext-pro';
import { registerQrcFile } from './commands/file-ext-qrc';
import { registerQdocFile } from './commands/file-ext-qdoc';
import { registerUiFile } from './commands/file-ext-ui';
import { registerKitDirectoryCommand } from './commands/kit-directory';
import { registerMinGWgdbCommand } from './commands/mingw-gdb';
import { initStateManager } from './state';
import { configChecker } from './util/config';
import { registerResetQtExtCommand } from './commands/reset-qt-ext';
import { registerNatvisCommand } from './commands/natvis';

export async function activate(context: vscode.ExtensionContext) {
  const promiseActivateCMake = vscode.extensions
    .getExtension('ms-vscode.cmake-tools')
    ?.activate();
  const activateStart = performance.now();
  initCMakeKits(context);
  initStateManager(context);

  registerUiFile(context);
  registerQtCommand(context);

  context.subscriptions.push(
    registerProFile(),
    registerQrcFile(),
    registerQdocFile(),
    registerKitDirectoryCommand(),
    registerMinGWgdbCommand(),
    registerResetQtExtCommand(),
    ...registerNatvisCommand()
  );

  registerConfigWatchers(context);

  void checkForQtInstallations();
  checkDefaultQtFolderPath();

  const activateEnd = performance.now();
  const activationTime = activateEnd - activateStart;
  console.log(
    `Done activating plugin ${context.extension.id}, took ${activationTime}ms`
  );

  await promiseActivateCMake;
}

function registerConfigWatchers(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(
      configChecker('vscode-qt-tools.qtFolder', onQtFolderUpdated)
    )
  );
}

export function deactivate() {
  console.log('Deactivating vscode-qt-tools');
}

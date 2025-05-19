// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import {
  IsWindows,
  telemetry
  //, QtInsRootConfigName
} from 'qt-lib';
import { kitManager } from '@/extension';
import { EXTENSION_ID } from '@/constants';

export function registerScanForQtKitsCommand() {
  void vscode.window.showInformationMessage('Testing Window');

  return vscode.commands.registerCommand(
    `${EXTENSION_ID}.scanForQtKits`,
    async () => {
      telemetry.sendAction('scanForQtKits');
      if (IsWindows) {
        await vscode.commands.executeCommand('cmake.scanForKits');
      }
      await kitManager.checkForAllQtInstallations();
    }
  );
}

export async function dummyregisterQt() {
  const options: vscode.OpenDialogOptions = {
    canSelectMany: false,
    openLabel: 'Dummy Select Qt installation root',
    canSelectFiles: false,
    canSelectFolders: true
  };
  const selectedQtInsRootUri = await vscode.window.showOpenDialog(options);
  if (selectedQtInsRootUri?.[0] === undefined) {
    return;
  }
  const selectedQtInsRoot = selectedQtInsRootUri[0].fsPath;
  if (selectedQtInsRoot) {
    setGlobalQtInstallationRoot(selectedQtInsRoot);
  }
  return 0;
}
function setGlobalQtInstallationRoot(qtInsRoot: string) {
  console.log(qtInsRoot);
  //logger.info(`Setting global Qt installation root to: ${qtInsRoot}`);
  // const config = vscode.workspace.getConfiguration(EXTENSION_ID);
  // await config.update(
  //   QtInsRootConfigName,
  //   qtInsRoot,
  //   vscode.ConfigurationTarget.Global
  // );
}

export class MyClass {
  constructor() {
    console.log('initiate MyClass');
  }

  add(arg1: number, arg2: number) {
    this;
    const value = arg1 + arg2;
    return value;
  }
  test_function(arg1: number, arg2: number) {
    return this.add(arg1, arg2);
  }
}

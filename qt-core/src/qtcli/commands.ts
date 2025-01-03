// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import * as vscode from 'vscode';

import { EXTENSION_ID } from '@/constants';
import { QtcliRunner } from '@/qtcli/runner';
import { QtcliNewNameInput } from '@/qtcli/new-name-input';
import { QtcliExeFinder } from '@/qtcli/exe-finder';
import {
  QtcliAction,
  findActiveTabUri,
  fallbackWorkingDir,
  logger
} from '@/qtcli/common';

let runner: QtcliRunner | undefined = undefined;
let newProjectBaseDir: string | undefined = undefined;

export function newFileCommand(context: vscode.ExtensionContext) {
  return vscode.commands.registerCommand(
    `${EXTENSION_ID}.createNewFile`,
    () => {
      void askNameAndRun(QtcliAction.NewFile, context);
    }
  );
}

export function newProjectCommand(context: vscode.ExtensionContext) {
  return vscode.commands.registerCommand(
    `${EXTENSION_ID}.createNewProject`,
    () => {
      void askNameAndRun(QtcliAction.NewProject, context);
    }
  );
}

async function askNameAndRun(
  action: QtcliAction,
  context: vscode.ExtensionContext
) {
  const exePath = await findQtcliExePath(context);
  if (!exePath) {
    const msg = 'Could not find qtcli executable.';
    logger.error(msg);
    void vscode.window.showErrorMessage(
      msg +
        ' ' +
        'Please ensure that a qtcli executable is available in your PATH.'
    );
    return;
  }

  const input = new QtcliNewNameInput(action);
  input.setWorkingDir(findWorkingDir(action));
  input.onDidChangeWorkingDir((dir) => {
    if (action === QtcliAction.NewProject) {
      newProjectBaseDir = dir;
    }
  });
  input.onDidAccept(() => {
    const value = input.getValue().trim();
    if (value.length === 0 || !input.hasValidInput()) {
      return;
    }

    if (!runner) {
      runner = new QtcliRunner();
    }

    runner.setQtcliExePath(exePath);
    runner.setWorkingDir(input.getWorkingDir());
    void runner.run(action, value);
  });
  input.show();
}

async function findQtcliExePath(context: vscode.ExtensionContext) {
  const finder = new QtcliExeFinder();
  finder.addPossibleDir(process.cwd());
  finder.addPossibleDir((process.env.PATH ?? '').split(path.delimiter));
  finder.addPossibleDir(path.join(context.extensionPath, 'res', 'qtcli'));

  return finder.run();
}

function findWorkingDir(action: QtcliAction) {
  if (action === QtcliAction.NewProject) {
    return newProjectBaseDir ?? fallbackWorkingDir();
  }

  const activeFileUri = findActiveTabUri();
  if (activeFileUri) {
    return path.dirname(activeFileUri.fsPath);
  }

  const anyFolder = vscode.workspace.workspaceFolders?.[0];
  return anyFolder ? anyFolder.uri.fsPath : fallbackWorkingDir();
}

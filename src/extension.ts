// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import { performance } from 'perf_hooks';
import {
  checkDefaultQtFolderPath,
  registerQtCommand
} from './commands/register-qt-path';
import { registerUiFile } from './commands/file-ext-ui';
import { registerKitDirectoryCommand } from './commands/kit-directory';
import { registerMinGWgdbCommand } from './commands/mingw-gdb';
import { registerResetQtExtCommand } from './commands/reset-qt-ext';
import { registerNatvisCommand } from './commands/natvis';
import { registerScanForQtKitsCommand } from './commands/scan-qt-kits';
import { designerServer } from './designer-server';
import { designerClient } from './designer-client';
import { UIEditorProvider } from './editors/ui/ui-editor';
import { Project, ProjectManager } from './project';
import { KitManager } from './kit-manager';

export let kitManager: KitManager;
export let projectManager: ProjectManager;
export async function activate(context: vscode.ExtensionContext) {
  const promiseActivateCMake = vscode.extensions
    .getExtension('ms-vscode.cmake-tools')
    ?.activate();
  const activateStart = performance.now();
  kitManager = new KitManager(context);
  projectManager = new ProjectManager(context);
  if (vscode.workspace.workspaceFile !== undefined) {
    kitManager.addWorkspaceFile(vscode.workspace.workspaceFile);
  }
  if (vscode.workspace.workspaceFolders !== undefined) {
    for (const folder of vscode.workspace.workspaceFolders) {
      const project = new Project(folder, context);
      projectManager.addProject(project);
      kitManager.addProject(project);
    }
  }

  designerServer.start();

  registerUiFile(context);
  registerQtCommand(context);

  context.subscriptions.push(
    registerKitDirectoryCommand(),
    registerMinGWgdbCommand(),
    registerResetQtExtCommand(),
    ...registerNatvisCommand(),
    UIEditorProvider.register(context),
    registerScanForQtKitsCommand()
  );

  await kitManager.checkForAllQtInstallations();
  checkDefaultQtFolderPath();

  const activateEnd = performance.now();
  const activationTime = activateEnd - activateStart;
  console.log(
    `Done activating plugin ${context.extension.id}, took ${activationTime}ms`
  );

  await promiseActivateCMake;
}

export function deactivate() {
  designerServer.stop();
  designerClient.stop();
  console.log('Deactivating vscode-qt-tools');
}

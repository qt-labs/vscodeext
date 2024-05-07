// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import { performance } from 'perf_hooks';

import {
  checkDefaultQtFolderPath,
  registerQtCommand
} from '@cmd/register-qt-path';
import { registerKitDirectoryCommand } from '@cmd/kit-directory';
import { registerMinGWgdbCommand } from '@cmd/mingw-gdb';
import { registerResetQtExtCommand } from '@cmd/reset-qt-ext';
import { registerNatvisCommand } from '@cmd/natvis';
import { registerScanForQtKitsCommand } from '@cmd/scan-qt-kits';
import {
  registerbuildDirectoryName,
  registerlaunchTargetFilenameWithoutExtension
} from '@cmd/launch-variables';
import { UIEditorProvider } from './editors/ui/ui-editor';
import { Project, ProjectManager } from '@/project';
import { KitManager } from '@/kit-manager';
import { wasmStartTaskProvider, WASMStartTaskProvider } from '@task/wasm-start';
import { registerOpenSettingsCommand } from '@cmd/navigator';

export let kitManager: KitManager;
export let projectManager: ProjectManager;
let taskProvider: vscode.Disposable | undefined;

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
      const project = await Project.createProject(folder, context);
      projectManager.addProject(project);
      kitManager.addProject(project);
    }
  }

  registerQtCommand(context);

  context.subscriptions.push(
    registerKitDirectoryCommand(),
    registerMinGWgdbCommand(),
    registerResetQtExtCommand(),
    ...registerNatvisCommand(),
    UIEditorProvider.register(context),
    registerScanForQtKitsCommand(),
    registerlaunchTargetFilenameWithoutExtension(),
    registerbuildDirectoryName(),
    registerOpenSettingsCommand()
  );

  taskProvider = vscode.tasks.registerTaskProvider(
    WASMStartTaskProvider.WASMStartType,
    wasmStartTaskProvider
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
  console.log('Deactivating vscode-qt-tools');
  projectManager.dispose();
  if (taskProvider) {
    taskProvider.dispose();
  }
}

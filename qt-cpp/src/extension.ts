// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import {
  CoreAPI,
  getCoreApi,
  QtWorkspaceType,
  createLogger,
  initLogger,
  QtWorkspaceConfigMessage,
  QtInsRootConfigName,
  AdditionalQtPathsName,
  GlobalWorkspace,
  QtAdditionalPath
} from 'qt-lib';
import { getSelectedQtInstallationPath } from '@cmd/register-qt-path';
import { registerKitDirectoryCommand } from '@cmd/kit-directory';
import { registerMinGWgdbCommand } from '@cmd/mingw-gdb';
import { registerResetCommand } from '@cmd/reset-qt-ext';
import { registerNatvisCommand } from '@cmd/natvis';
import { registerScanForQtKitsCommand } from '@cmd/scan-qt-kits';
import {
  registerbuildDirectoryName,
  registerlaunchTargetFilenameWithoutExtension
} from '@cmd/launch-variables';
import { createCppProject, CppProjectManager, CppProject } from '@/project';
import { KitManager } from '@/kit-manager';
import { wasmStartTaskProvider, WASMStartTaskProvider } from '@task/wasm-start';
import { EXTENSION_ID } from '@/constants';

export let kitManager: KitManager;
export let projectManager: CppProjectManager;
export let coreAPI: CoreAPI | undefined;

let taskProvider: vscode.Disposable | undefined;

const logger = createLogger('extension');

export async function activate(context: vscode.ExtensionContext) {
  await vscode.extensions.getExtension('ms-vscode.cmake-tools')?.activate();

  initLogger(EXTENSION_ID);
  kitManager = new KitManager(context);
  projectManager = new CppProjectManager(context);
  coreAPI = await getCoreApi();

  if (vscode.workspace.workspaceFolders !== undefined) {
    for (const folder of vscode.workspace.workspaceFolders) {
      const project = await createCppProject(folder, context);
      projectManager.addProject(project);
      kitManager.addProject(project);
    }
  }

  context.subscriptions.push(
    registerKitDirectoryCommand(),
    registerMinGWgdbCommand(),
    registerResetCommand(),
    ...registerNatvisCommand(),
    registerScanForQtKitsCommand(),
    registerlaunchTargetFilenameWithoutExtension(),
    registerbuildDirectoryName()
  );

  taskProvider = vscode.tasks.registerTaskProvider(
    WASMStartTaskProvider.WASMStartType,
    wasmStartTaskProvider
  );

  coreAPI?.onValueChanged((message) => {
    logger.info('Received config change:', message.config as unknown as string);
    processMessage(message);
  });
  await kitManager.checkForAllQtInstallations();

  await initCoreValues();
  logger.info('Core values initialized');
}

export function deactivate() {
  logger.info(`Deactivating ${EXTENSION_ID}`);
  projectManager.dispose();
  if (taskProvider) {
    taskProvider.dispose();
  }
}

export async function initCoreValues() {
  if (!coreAPI) {
    throw new Error('CoreAPI is not initialized');
  }

  for (const project of projectManager.getProjects()) {
    const folder = project.folder;
    const selectedKitPath = await getSelectedQtInstallationPath(folder);
    const message = new QtWorkspaceConfigMessage(folder);
    if (selectedKitPath) {
      logger.info(
        `Setting selected kit path for ${folder.uri.fsPath} to ${selectedKitPath}`
      );
      message.config.set('selectedKitPath', selectedKitPath);
    }
    message.config.set('workspaceType', QtWorkspaceType.CMakeExt);
    logger.info('Updating coreAPI with message:', message as unknown as string);
    coreAPI.update(message);
  }
}

function processMessage(message: QtWorkspaceConfigMessage) {
  // check if workspace folder is a string
  let project: CppProject | undefined;
  if (typeof message.workspaceFolder === 'string') {
    if (message.workspaceFolder !== GlobalWorkspace) {
      throw new Error('Invalid global workspace');
    }
  } else {
    project = projectManager.getProject(message.workspaceFolder);
    if (!project) {
      logger.info('Project not found');
      return;
    }
  }

  const qtInsRoot = message.get<string>(QtInsRootConfigName);
  if (qtInsRoot !== undefined) {
    void kitManager.onQtInstallationRootChanged(qtInsRoot, project?.folder);
  }
  const additionalQtPaths = message.get<QtAdditionalPath[]>(
    AdditionalQtPathsName
  );
  if (additionalQtPaths !== undefined) {
    kitManager.onQtPathsChanged(additionalQtPaths, project?.folder);
  }
}

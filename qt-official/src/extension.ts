// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import {
  CoreApi,
  getCoreApi,
  QtWorkspaceType,
  createLogger,
  initLogger,
  QtWorkspaceConfigMessage,
  QtInsRootConfigName,
  GlobalWorkspace
} from 'qt-lib';
import { getSelectedQtInstallationPath } from '@cmd/register-qt-path';
import { registerKitDirectoryCommand } from '@cmd/kit-directory';
import { registerMinGWgdbCommand } from '@cmd/mingw-gdb';
import { registerResetQtExtCommand } from '@cmd/reset-qt-ext';
import { registerNatvisCommand } from '@cmd/natvis';
import { registerScanForQtKitsCommand } from '@cmd/scan-qt-kits';
import {
  registerbuildDirectoryName,
  registerlaunchTargetFilenameWithoutExtension
} from '@cmd/launch-variables';
import { Project, ProjectManager } from '@/project';
import { KitManager } from '@/kit-manager';
import { wasmStartTaskProvider, WASMStartTaskProvider } from '@task/wasm-start';
import { registerColorProvider } from '@/color-provider';
import { registerRestartQmllsCommand } from '@cmd/restart-qmlls';
import { Qmlls } from '@/qmlls';
import { EXTENSION_ID } from '@/constants';

export let kitManager: KitManager;
export let projectManager: ProjectManager;
export let qmlls: Qmlls;
export let coreApi: CoreApi | undefined;

let taskProvider: vscode.Disposable | undefined;

const logger = createLogger('extension');

export async function activate(context: vscode.ExtensionContext) {
  await vscode.extensions.getExtension('ms-vscode.cmake-tools')?.activate();

  initLogger(EXTENSION_ID);
  kitManager = new KitManager(context);
  projectManager = new ProjectManager(context);
  coreApi = await getCoreApi();

  if (vscode.workspace.workspaceFolders !== undefined) {
    for (const folder of vscode.workspace.workspaceFolders) {
      const project = await Project.createProject(folder, context);
      projectManager.addProject(project);
      kitManager.addProject(project);
    }
  }

  context.subscriptions.push(
    registerKitDirectoryCommand(),
    registerMinGWgdbCommand(),
    registerResetQtExtCommand(),
    ...registerNatvisCommand(),
    registerScanForQtKitsCommand(),
    registerlaunchTargetFilenameWithoutExtension(),
    registerbuildDirectoryName(),
    registerRestartQmllsCommand(),
    registerColorProvider()
  );

  taskProvider = vscode.tasks.registerTaskProvider(
    WASMStartTaskProvider.WASMStartType,
    wasmStartTaskProvider
  );

  coreApi?.onValueChanged((message) => {
    logger.info('Received config change:', message.config as unknown as string);
    processMessage(message);
  });
  await kitManager.checkForAllQtInstallations();

  await initCoreValues();
  logger.info('Core values initialized');
  qmlls = new Qmlls();
  void qmlls.start();
}

export function deactivate() {
  logger.info(`Deactivating ${EXTENSION_ID}`);
  projectManager.dispose();
  if (taskProvider) {
    taskProvider.dispose();
  }
  void qmlls.stop();
}

export async function initCoreValues() {
  if (!coreApi) {
    throw new Error('CoreApi is not initialized');
  }
  for (const project of projectManager.getProjects()) {
    const folder = project.getFolder();
    const selectedKitPath = await getSelectedQtInstallationPath(
      project.getFolder()
    );
    const message = new QtWorkspaceConfigMessage(folder);
    if (selectedKitPath) {
      logger.info(
        `Setting selected kit path for ${folder.uri.fsPath} to ${selectedKitPath}`
      );
      message.config.set('selectedKitPath', selectedKitPath);
    }
    message.config.set('workspaceType', QtWorkspaceType.CMakeExt);
    logger.info('Updating coreApi with message:', message as unknown as string);
    coreApi.update(message);
  }
}

function processMessage(message: QtWorkspaceConfigMessage) {
  // check if workspace folder is a string
  if (typeof message.workspaceFolder === 'string') {
    if (message.workspaceFolder === GlobalWorkspace) {
      void kitManager.onQtInstallationRootChanged(
        message.config.get(QtInsRootConfigName) ?? ''
      );
      return;
    }
    return;
  }
  const project = projectManager.getProject(message.workspaceFolder);
  if (!project) {
    logger.info('Project not found');
    return;
  }
  void kitManager.onQtInstallationRootChanged(
    message.config.get(QtInsRootConfigName) ?? '',
    project.folder
  );
}

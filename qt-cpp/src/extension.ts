// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import {
  CoreAPI,
  getCoreApi,
  createLogger,
  initLogger,
  QtWorkspaceConfigMessage,
  QtInsRootConfigName,
  AdditionalQtPathsName,
  GlobalWorkspace,
  QtAdditionalPath,
  telemetry
} from 'qt-lib';
import { registerMinGWgdbCommand } from '@cmd/mingw-gdb';
import { registerResetCommand } from '@cmd/reset-qt-ext';
import { registerNatvisCommand } from '@cmd/natvis';
import { registerScanForQtKitsCommand } from '@cmd/scan-qt-kits';
import { registerSourceDirectoryCommand } from '@cmd/source-directory';
import {
  registerbuildDirectoryName,
  registerlaunchTargetFilenameWithoutExtension,
  registerKitDirectoryCommand,
  qtDirCommand,
  qpaPlatformPluginPathCommand,
  qmlImportPathCommand
} from '@cmd/launch-variables';
import { createCppProject, CppProjectManager, CppProject } from '@/project';
import { KitManager, tryToUseCMakeFromQtTools } from '@/kit-manager';
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
  telemetry.activate(context);
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
    qpaPlatformPluginPathCommand(),
    qmlImportPathCommand(),
    registerKitDirectoryCommand(),
    qtDirCommand(),
    registerMinGWgdbCommand(),
    registerResetCommand(),
    ...registerNatvisCommand(),
    registerScanForQtKitsCommand(),
    registerlaunchTargetFilenameWithoutExtension(),
    registerbuildDirectoryName(),
    registerSourceDirectoryCommand()
  );
  telemetry.sendEvent(`activated`);

  taskProvider = vscode.tasks.registerTaskProvider(
    WASMStartTaskProvider.WASMStartType,
    wasmStartTaskProvider
  );

  coreAPI?.onValueChanged(async (message) => {
    logger.info('Received config change:', message.config as unknown as string);
    return processMessage(message);
  });
  void tryToUseCMakeFromQtTools();
  await kitManager.checkForAllQtInstallations();

  await initConfigValues();
  logger.info('Config values initialized');
}

export function deactivate() {
  logger.info(`Deactivating ${EXTENSION_ID}`);
  telemetry.dispose();
  projectManager.dispose();
  if (taskProvider) {
    taskProvider.dispose();
  }
}

export async function initConfigValues() {
  for (const project of projectManager.getProjects()) {
    await project.initConfigValues();
  }
}

async function processMessage(message: QtWorkspaceConfigMessage) {
  // check if workspace folder is a string
  let project: CppProject | undefined;
  if (typeof message.workspaceFolder === 'string') {
    if (message.workspaceFolder !== GlobalWorkspace) {
      throw new Error('Invalid global workspace');
    }
  } else {
    project = projectManager.getProject(message.workspaceFolder);
    if (!project) {
      logger.error('Project not found');
      return;
    }
  }
  for (const key of message.config.keys()) {
    if (key === QtInsRootConfigName) {
      const value =
        coreAPI?.getValue<string>(
          message.workspaceFolder,
          QtInsRootConfigName
        ) ?? '';
      await kitManager.onQtInstallationRootChanged(value, project?.folder);
      continue;
    }

    if (key === AdditionalQtPathsName) {
      const additionalQtPaths =
        coreAPI?.getValue<QtAdditionalPath[]>(
          message.workspaceFolder,
          AdditionalQtPathsName
        ) ?? [];
      await kitManager.onQtPathsChanged(additionalQtPaths, project?.folder);
      continue;
    }
  }
}

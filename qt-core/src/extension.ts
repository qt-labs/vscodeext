// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import {
  createLogger,
  GlobalWorkspace,
  initLogger,
  QtInsRootConfigName,
  AdditionalQtPathsName,
  telemetry,
  createColorProvider
} from 'qt-lib';
import { CoreAPIImpl } from '@/api';
import { registerDocumentationCommands } from '@/online-docs';
import { registerSetRecommendedSettingsCommand } from '@/recommended-settings';
import {
  checkDefaultQtInsRootPath,
  getCurrentGlobalAdditionalQtPaths,
  getCurrentGlobalQtInstallationRoot,
  registerQt
} from '@/installation-root';
import { EXTENSION_ID } from '@/constants';
import { createCoreProject, CoreProjectManager } from '@/project';
import { resetCommand } from '@/reset';
import { registerQtByQtpaths } from '@/qtpaths';
import { checkVcpkg } from '@/vcpkg';

const logger = createLogger('extension');

export let coreAPI: CoreAPIImpl | undefined;
export let projectManager: CoreProjectManager;

export async function activate(context: vscode.ExtensionContext) {
  initLogger(EXTENSION_ID);
  telemetry.activate(context);
  logger.info(`Activating ${context.extension.id}`);
  projectManager = new CoreProjectManager(context);
  if (vscode.workspace.workspaceFile !== undefined) {
    projectManager.addWorkspaceFile(vscode.workspace.workspaceFile);
  }
  if (vscode.workspace.workspaceFolders !== undefined) {
    for (const folder of vscode.workspace.workspaceFolders) {
      const project = await createCoreProject(folder, context);
      projectManager.addProject(project);
    }
  }
  context.subscriptions.push(...registerDocumentationCommands());
  context.subscriptions.push(registerSetRecommendedSettingsCommand());
  context.subscriptions.push(resetCommand());
  context.subscriptions.push(registerQtByQtpaths());
  context.subscriptions.push(
    vscode.commands.registerCommand(`${EXTENSION_ID}.openSettings`, () => {
      telemetry.sendAction('openSettings');
      void vscode.commands.executeCommand(
        'workbench.action.openSettings',
        `@ext:theqtcompany.qt-cpp @ext:theqtcompany.qt-qml @ext:theqtcompany.qt-ui @ext:theqtcompany.${EXTENSION_ID}`
      );
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(`${EXTENSION_ID}.registerQt`, registerQt)
  );
  context.subscriptions.push(
    vscode.languages.registerColorProvider('qss', createColorProvider())
  );

  telemetry.sendEvent(`activated`);

  checkDefaultQtInsRootPath();
  checkVcpkg();
  coreAPI = new CoreAPIImpl();
  initCoreValues();
  return coreAPI;
}

export function deactivate() {
  logger.info(`Deactivating ${EXTENSION_ID}`);
  telemetry.dispose();
  projectManager.dispose();
}

export function initCoreValues() {
  coreAPI?.setValue(
    GlobalWorkspace,
    QtInsRootConfigName,
    getCurrentGlobalQtInstallationRoot()
  );
  coreAPI?.setValue(
    GlobalWorkspace,
    AdditionalQtPathsName,
    getCurrentGlobalAdditionalQtPaths()
  );

  for (const project of projectManager.getProjects()) {
    project.initConfigValues();
  }
}

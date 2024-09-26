// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import {
  createLogger,
  GlobalWorkspace,
  initLogger,
  QtInsRootConfigName,
  QtWorkspaceConfigMessage
} from 'qt-lib';
import { CoreAPIImpl } from '@/api';
import { registerDocumentationCommands } from '@/online-docs';
import { registerSetRecommendedSettingsCommand } from '@/recommended-settings';
import {
  checkDefaultQtInsRootPath,
  getCurrentGlobalQtInstallationRoot,
  registerQt
} from '@/installation-root';
import { EXTENSION_ID } from '@/constants';
import { Project, ProjectManager } from '@/project';
import { resetCommand } from '@/reset';

const logger = createLogger('extension');

export let coreAPI: CoreAPIImpl | undefined;
let projectManager: ProjectManager;

export function activate(context: vscode.ExtensionContext) {
  initLogger(EXTENSION_ID);
  logger.info(`Activating ${context.extension.id}`);
  projectManager = new ProjectManager(context);
  if (vscode.workspace.workspaceFile !== undefined) {
    projectManager.addWorkspaceFile(vscode.workspace.workspaceFile);
  }
  if (vscode.workspace.workspaceFolders !== undefined) {
    for (const folder of vscode.workspace.workspaceFolders) {
      const project = Project.createProject(folder, context);
      projectManager.addProject(project);
    }
  }
  context.subscriptions.push(...registerDocumentationCommands());
  context.subscriptions.push(registerSetRecommendedSettingsCommand());
  context.subscriptions.push(resetCommand());
  context.subscriptions.push(
    vscode.commands.registerCommand(`${EXTENSION_ID}.openSettings`, () => {
      void vscode.commands.executeCommand(
        'workbench.action.openSettings',
        `@ext:theqtcompany.qt-cpp @ext:theqtcompany.qt-qml @ext:theqtcompany.qt-ui @ext:theqtcompany.${EXTENSION_ID}`
      );
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(`${EXTENSION_ID}.registerQt`, registerQt)
  );

  checkDefaultQtInsRootPath();
  coreAPI = new CoreAPIImpl();
  initCoreValues();
  return coreAPI;
}

export function deactivate() {
  logger.info(`Deactivating ${EXTENSION_ID}`);
}

export function initCoreValues() {
  const globalUpdateMessage = new QtWorkspaceConfigMessage(GlobalWorkspace);
  globalUpdateMessage.config.set(
    QtInsRootConfigName,
    getCurrentGlobalQtInstallationRoot()
  );
  coreAPI?.update(globalUpdateMessage);

  for (const project of projectManager.getProjects()) {
    const folder = project.getFolder();
    const message = new QtWorkspaceConfigMessage(folder);
    message.config.set(
      QtInsRootConfigName,
      ProjectManager.getWorkspaceFolderQtInsRoot(folder)
    );
    logger.info('Updating coreAPI with message:', message as unknown as string);
    coreAPI?.update(message);
  }
}

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
import { CoreApiImpl } from '@/api';
import { registerDocumentationCommands } from '@/online-docs';
import { registerSetRecommendedSettingsCommand } from '@/recommended-settings';
import {
  checkDefaultQtInsRootPath,
  getCurrentGlobalQtInstallationRoot,
  registerQt
} from '@/installation-root';
import { EXTENSION_ID } from '@/constants';
import { Project, ProjectManager } from '@/project';

const logger = createLogger('extension');

export let CoreAPI: CoreApiImpl;
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
  context.subscriptions.push(
    vscode.commands.registerCommand(`${EXTENSION_ID}.openSettings`, () => {
      void vscode.commands.executeCommand(
        'workbench.action.openSettings',
        '@ext:theqtcompany.qt-official @ext:theqtcompany.qt-ui @ext:theqtcompany.qt-core'
      );
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(`${EXTENSION_ID}.registerQt`, registerQt)
  );

  checkDefaultQtInsRootPath();
  CoreAPI = new CoreApiImpl();
  initCoreValues();
  return CoreAPI;
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
  CoreAPI.update(globalUpdateMessage);

  for (const project of projectManager.getProjects()) {
    const folder = project.getFolder();
    const message = new QtWorkspaceConfigMessage(folder);
    message.config.set(
      QtInsRootConfigName,
      ProjectManager.getWorkspaceFolderQtInsRoot(folder)
    );
    logger.info('Updating coreApi with message:', message as unknown as string);
    CoreAPI.update(message);
  }
}

// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import {
  CoreAPI,
  getCoreApi,
  QtWorkspaceConfigMessage,
  QtWorkspaceType,
  ProjectManager,
  createLogger,
  initLogger
} from 'qt-lib';
import { UIEditorProvider } from '@/editors/ui/ui-editor';
import { createUIProject, UIProject } from '@/project';
import { EXTENSION_ID } from '@/constants';
import { openWidgetDesigner } from '@/commands';

const logger = createLogger('extension');

export let projectManager: ProjectManager<UIProject>;
export let coreAPI: CoreAPI | undefined;

export async function activate(context: vscode.ExtensionContext) {
  initLogger(EXTENSION_ID);
  logger.info(`Activating ${context.extension.id}`);
  coreAPI = await getCoreApi();
  if (!coreAPI) {
    const err = 'Failed to get CoreAPI';
    logger.error(err);
    throw new Error(err);
  }

  projectManager = new ProjectManager<UIProject>(context, createUIProject);
  projectManager.onProjectAdded(async (project) => {
    logger.info('Project added:', project.folder.uri.fsPath);
    const selectedKitPath = coreAPI?.getValue<string>(
      project.folder,
      'selectedKitPath'
    );
    const workspaceType = coreAPI?.getValue<QtWorkspaceType>(
      project.folder,
      'workspaceType'
    );
    if (workspaceType) {
      project.workspaceType = workspaceType;
    }

    if (selectedKitPath) {
      await project.setBinDir(selectedKitPath);
    }
  });
  projectManager.onProjectRemoved((project) => {
    logger.info('Project removed:', project.folder.uri.fsPath);
  });
  if (vscode.workspace.workspaceFolders !== undefined) {
    for (const folder of vscode.workspace.workspaceFolders) {
      const project = await createUIProject(folder, context);
      projectManager.addProject(project);
    }
  }
  coreAPI.onValueChanged((message) => {
    logger.info('Received config change:', message.config as unknown as string);
    processMessage(message);
  });
  context.subscriptions.push(UIEditorProvider.register(context));
  context.subscriptions.push(
    vscode.commands.registerCommand(
      `${EXTENSION_ID}.openWidgetDesigner`,
      openWidgetDesigner
    )
  );
}

export function deactivate() {
  logger.info(`Deactivating ${EXTENSION_ID}`);
}

function processMessage(message: QtWorkspaceConfigMessage) {
  // check if workspace folder is a string
  if (typeof message.workspaceFolder === 'string') {
    return;
  }
  const project = projectManager.getProject(message.workspaceFolder);
  if (!project) {
    logger.error('Project not found');
    return;
  }
  const selectedKitPath = message.get<string>('selectedKitPath');
  if (selectedKitPath !== project.binDir) {
    void project.setBinDir(selectedKitPath);
  }
  if (message.config.has('workspaceType')) {
    project.workspaceType = message.config.get(
      'workspaceType'
    ) as QtWorkspaceType;
  }
}

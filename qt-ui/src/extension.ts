// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import {
  CoreApi,
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

const logger = createLogger('extension');

export let projectManager: ProjectManager<UIProject>;
export let QtCoreApi: CoreApi | undefined;

export async function activate(context: vscode.ExtensionContext) {
  initLogger(EXTENSION_ID);
  logger.info(`Activating ${context.extension.id}`);
  QtCoreApi = await getCoreApi();
  if (!QtCoreApi) {
    const err = 'Failed to get CoreApi';
    logger.error(err);
    throw new Error(err);
  }

  projectManager = new ProjectManager<UIProject>(context, createUIProject);
  projectManager.onProjectAdded(async (project) => {
    logger.info('Project added:', project.folder.uri.fsPath);
    const selectedKitPath = QtCoreApi?.getValue<string>(
      project.folder,
      'selectedKitPath'
    );
    const workspaceType = QtCoreApi?.getValue<QtWorkspaceType>(
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
      const project = createUIProject(folder, context);
      projectManager.addProject(project);
    }
  }
  QtCoreApi.onValueChanged((message) => {
    logger.info('Received config change:', message.config as unknown as string);
    processMessage(message);
  });
  context.subscriptions.push(UIEditorProvider.register(context));
}

export function deactivate() {
  logger.info(`Deactivating ${EXTENSION_ID}`);
}

function processMessage(message: QtWorkspaceConfigMessage) {
  const project = projectManager.getProject(message.workspaceFolder);
  if (!project) {
    logger.error('Project not found');
    return;
  }
  const selectedKitPath = message.config.get('selectedKitPath');
  if (selectedKitPath !== project.binDir) {
    void project.setBinDir(selectedKitPath);
  }
  if (message.config.has('workspaceType')) {
    project.workspaceType = message.config.get(
      'workspaceType'
    ) as QtWorkspaceType;
  }
}

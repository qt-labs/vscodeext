// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as cmakeApi from 'vscode-cmake-tools';

import { WorkspaceStateManager } from '@/state';
import { coreAPI, kitManager } from '@/extension';
import { createLogger, QtWorkspaceConfigMessage } from 'qt-lib';
import { Project, ProjectManager } from 'qt-lib';
import { getSelectedQtInstallationPath } from '@cmd/register-qt-path';

const logger = createLogger('project');

export async function createCppProject(
  folder: vscode.WorkspaceFolder,
  context: vscode.ExtensionContext
) {
  logger.info('Creating project:"' + folder.uri.fsPath + '"');
  const api = await cmakeApi.getCMakeToolsApi(cmakeApi.Version.latest);
  let cmakeProject: cmakeApi.Project | undefined;
  if (api) {
    cmakeProject = await api.getProject(folder.uri);
  }
  return Promise.resolve(new CppProject(folder, context, cmakeProject));
}

// Project class represents a workspace folder in the extension.
export class CppProject implements Project {
  private readonly _stateManager: WorkspaceStateManager;
  private readonly _cmakeProject: cmakeApi.Project | undefined;
  constructor(
    private readonly _folder: vscode.WorkspaceFolder,
    readonly _context: vscode.ExtensionContext,
    cmakeProject: cmakeApi.Project | undefined
  ) {
    this._cmakeProject = cmakeProject;
    this._stateManager = new WorkspaceStateManager(_context, _folder);

    if (this._cmakeProject) {
      this._cmakeProject.onSelectedConfigurationChanged(
        async (configurationType: cmakeApi.ConfigurationType) => {
          if (configurationType === cmakeApi.ConfigurationType.Kit) {
            let selectedCMakeKit =
              await vscode.commands.executeCommand<string>('cmake.buildKit');
            logger.info('Selected kit:', selectedCMakeKit);
            if (selectedCMakeKit === '__unspec__') {
              selectedCMakeKit = '';
            }
            const selectedKitPath = await getSelectedQtInstallationPath(
              this.folder
            );
            const message = new QtWorkspaceConfigMessage(this.folder);
            message.config.set('selectedKitPath', selectedKitPath);
            coreAPI?.update(message);
          }
        }
      );
    }
  }

  public getStateManager() {
    return this._stateManager;
  }
  get folder() {
    return this._folder;
  }

  dispose() {
    logger.info('Disposing project:', this._folder.uri.fsPath);
  }
}

export class CppProjectManager extends ProjectManager<CppProject> {
  constructor(override readonly context: vscode.ExtensionContext) {
    super(context, createCppProject);

    this.watchProjects(context);

    this.onProjectAdded((project: CppProject) => {
      logger.info('Adding project:', project.folder.uri.fsPath);
      kitManager.addProject(project);
    });

    this.onProjectRemoved((project: CppProject) => {
      kitManager.removeProject(project);
    });
  }
}

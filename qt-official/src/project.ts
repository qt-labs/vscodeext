// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as cmakeAPi from 'vscode-cmake-tools';

import { WorkspaceStateManager } from '@/state';
import { coreApi, kitManager } from '@/extension';
import { createLogger } from 'qt-lib';
import { ProjectBase, getEmptyQtWorkspaceConfigMessage } from 'qt-lib';
import { getSelectedQtInstallationPath } from '@cmd/register-qt-path';

const logger = createLogger('project');

// Project class represents a workspace folder in the extension.
export class Project implements ProjectBase {
  private readonly _stateManager: WorkspaceStateManager;
  private readonly _cmakeProject: cmakeAPi.Project | undefined;
  private constructor(
    private readonly _folder: vscode.WorkspaceFolder,
    readonly _context: vscode.ExtensionContext,
    cmakeProject: cmakeAPi.Project | undefined
  ) {
    this._cmakeProject = cmakeProject;
    this._stateManager = new WorkspaceStateManager(_context, _folder);

    if (this._cmakeProject) {
      this._cmakeProject.onSelectedConfigurationChanged(
        async (configurationType: cmakeAPi.ConfigurationType) => {
          if (configurationType === cmakeAPi.ConfigurationType.Kit) {
            let selectedCMakeKit =
              await vscode.commands.executeCommand<string>('cmake.buildKit');
            logger.info('Selected kit:', selectedCMakeKit);
            if (selectedCMakeKit === '__unspec__') {
              selectedCMakeKit = '';
            }
            const selectedKitPath = await getSelectedQtInstallationPath(
              this.folder
            );
            const message = getEmptyQtWorkspaceConfigMessage(this.folder);
            message.config.set('selectedKitPath', selectedKitPath);
            coreApi?.update(message);
          }
        }
      );
    }
  }

  static async createProject(
    folder: vscode.WorkspaceFolder,
    context: vscode.ExtensionContext
  ) {
    logger.info('Creating project:"' + folder.uri.fsPath + '"');
    const api = await cmakeAPi.getCMakeToolsApi(cmakeAPi.Version.latest);
    let cmakeProject: cmakeAPi.Project | undefined;
    if (api) {
      cmakeProject = await api.getProject(folder.uri);
    }
    return new Project(folder, context, cmakeProject);
  }
  public getStateManager() {
    return this._stateManager;
  }
  public getFolder() {
    return this._folder;
  }
  get folder() {
    return this._folder;
  }

  dispose() {
    logger.info('Disposing project:', this._folder.uri.fsPath);
  }
}

export class ProjectManager {
  projects = new Set<Project>();
  constructor(readonly context: vscode.ExtensionContext) {
    this.watchProjects(context);
  }
  public addProject(project: Project) {
    logger.info('Adding project:', project.getFolder().uri.fsPath);
    this.projects.add(project);
  }
  public getProjects() {
    return this.projects;
  }
  public getProject(folder: vscode.WorkspaceFolder) {
    return Array.from(this.projects).find(
      (project) => project.getFolder() === folder
    );
  }
  private watchProjects(context: vscode.ExtensionContext) {
    vscode.workspace.onDidChangeWorkspaceFolders(async (event) => {
      for (const folder of event.removed) {
        const project = this.getProject(folder);
        if (!project) {
          continue;
        }
        project.dispose();
        this.projects.delete(project);
        kitManager.removeProject(project);
      }
      for (const folder of event.added) {
        const project = await Project.createProject(folder, context);
        this.projects.add(project);
        kitManager.addProject(project);
      }
    });
  }
  public findProjectContainingFile(uri: vscode.Uri) {
    return Array.from(this.projects).find((project) => {
      const ret = uri.toString().startsWith(project.getFolder().uri.toString());
      return ret;
    });
  }
  dispose() {
    for (const project of this.projects) {
      project.dispose();
    }
    this.projects.clear();
  }
}

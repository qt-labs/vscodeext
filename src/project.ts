// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import { WorkspaceStateManager } from './state';
import { kitManager } from './extension';
import { DesignerClient } from './designer-client';
import { DesignerServer } from './designer-server';
import { getQtDesignerPath } from './util/get-qt-paths';

// Project class represents a workspace folder in the extension.
export class Project {
  private readonly _stateManager: WorkspaceStateManager;
  private readonly _designerClient: DesignerClient;
  private readonly _designerServer: DesignerServer;
  private constructor(
    readonly _folder: vscode.WorkspaceFolder,
    readonly _context: vscode.ExtensionContext,
    designerExePath: string
  ) {
    this._stateManager = new WorkspaceStateManager(_context, _folder);
    this._designerServer = new DesignerServer();
    this._designerClient = new DesignerClient(
      designerExePath,
      this._designerServer.getPort()
    );
  }

  static async createProject(
    folder: vscode.WorkspaceFolder,
    context: vscode.ExtensionContext
  ) {
    return new Project(folder, context, await getQtDesignerPath(folder));
  }
  public getStateManager() {
    return this._stateManager;
  }
  public getFolder() {
    return this._folder;
  }
  get designerServer() {
    return this._designerServer;
  }
  get designerClient() {
    return this._designerClient;
  }
  dispose() {
    this._designerServer.dispose();
    this._designerClient.dispose();
  }
}

export class ProjectManager {
  projects = new Set<Project>();
  constructor(readonly context: vscode.ExtensionContext) {
    this.watchProjects(context);
  }
  public addProject(project: Project) {
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

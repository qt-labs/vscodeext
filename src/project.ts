// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import { WorkspaceStateManager } from './state';
import { kitManager } from './extension';

// Project class represents a workspace folder in the extension.
export class Project {
  stateManager: WorkspaceStateManager;
  constructor(
    readonly folder: vscode.WorkspaceFolder,
    readonly context: vscode.ExtensionContext
  ) {
    this.stateManager = new WorkspaceStateManager(context, folder);
  }
  public getStateManager() {
    return this.stateManager;
  }
  public getFolder() {
    return this.folder;
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
  private watchProjects(context: vscode.ExtensionContext) {
    vscode.workspace.onDidChangeWorkspaceFolders((event) => {
      for (const folder of event.removed) {
        this.projects.delete(new Project(folder, context));
        kitManager.removeProject(new Project(folder, context));
      }
      for (const folder of event.added) {
        this.projects.add(new Project(folder, context));
        kitManager.addProject(new Project(folder, context));
      }
    });
  }
}

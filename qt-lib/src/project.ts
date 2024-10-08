// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

export interface Project {
  folder: vscode.WorkspaceFolder;
  dispose(): void;
}

export class ProjectManager<ProjectType extends Project> {
  projects = new Set<ProjectType>();
  private readonly _addEmitter = new vscode.EventEmitter<ProjectType>();
  private readonly _removeEmitter = new vscode.EventEmitter<ProjectType>();
  private _newProjectCallback: (
    folder: vscode.WorkspaceFolder,
    context: vscode.ExtensionContext
  ) => Promise<ProjectType | undefined>;

  constructor(
    readonly context: vscode.ExtensionContext,
    newProjectCallback: (
      folder: vscode.WorkspaceFolder,
      context: vscode.ExtensionContext
    ) => Promise<ProjectType | undefined>
  ) {
    this._newProjectCallback = newProjectCallback;
    this.watchProjects(context);
  }

  public addProject(project: ProjectType) {
    this.projects.add(project);
    this._addEmitter.fire(project);
  }

  public removeProject(project: ProjectType) {
    this._removeEmitter.fire(project);
    this.projects.delete(project);
  }

  public set newProjectCallback(
    callback: (
      folder: vscode.WorkspaceFolder,
      context: vscode.ExtensionContext
    ) => Promise<ProjectType | undefined>
  ) {
    this._newProjectCallback = callback;
  }

  public get newProjectCallback() {
    return this._newProjectCallback;
  }

  public getProjects() {
    return this.projects;
  }

  public getProject(folder: vscode.WorkspaceFolder): ProjectType | undefined {
    return Array.from(this.projects).find(
      (project) => project.folder === folder
    );
  }

  public get onProjectAdded() {
    return this._addEmitter.event;
  }

  public get onProjectRemoved() {
    return this._removeEmitter.event;
  }

  protected watchProjects(context: vscode.ExtensionContext) {
    vscode.workspace.onDidChangeWorkspaceFolders(async (event) => {
      for (const folder of event.removed) {
        const project = this.getProject(folder);
        if (!project) {
          continue;
        }
        project.dispose();
        this.removeProject(project);
      }
      for (const folder of event.added) {
        const project = await this._newProjectCallback(folder, context);
        if (!project) {
          continue;
        }
        this.addProject(project);
      }
    });
  }
  public findProjectContainingFile(uri: vscode.Uri) {
    return Array.from(this.projects).find((project) => {
      const ret = uri.toString().startsWith(project.folder.uri.toString());
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

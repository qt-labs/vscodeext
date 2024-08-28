// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { createLogger, GlobalWorkspace, QtInsRootConfigName } from 'qt-lib';
import { ProjectBase } from 'qt-lib';
import { getConfiguration } from '@/util';
import { GlobalStateManager, WorkspaceStateManager } from '@/state';
import {
  getCurrentGlobalQtInstallationRoot,
  onQtInsRootUpdated
} from '@/installation-root';

const logger = createLogger('project');

// Project class represents a workspace folder in the extension.
export class Project implements ProjectBase {
  private readonly _stateManager: WorkspaceStateManager;
  private _qtInstallationRoot: string | undefined;
  private constructor(
    private readonly _folder: vscode.WorkspaceFolder,
    readonly _context: vscode.ExtensionContext
  ) {
    this._stateManager = new WorkspaceStateManager(_context, _folder);
    this.watchWorkspaceFolderConfig(_context, _folder);
  }
  set qtInstallationRoot(value: string) {
    this._qtInstallationRoot = value;
  }
  get qtInstallationRoot() {
    return this._qtInstallationRoot ?? '';
  }
  static createProject(
    folder: vscode.WorkspaceFolder,
    context: vscode.ExtensionContext
  ) {
    logger.info('Creating project:"' + folder.uri.fsPath + '"');
    return new Project(folder, context);
  }
  get stateManager() {
    return this._stateManager;
  }
  public getFolder() {
    return this._folder;
  }
  get folder() {
    return this._folder;
  }
  private watchWorkspaceFolderConfig(
    context: vscode.ExtensionContext,
    folder: vscode.WorkspaceFolder
  ) {
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(
        (e: vscode.ConfigurationChangeEvent) => {
          void e;
          const previousQtInsRoot = this.stateManager.getQtInstallationRoot();
          const currentQtInsRoot =
            ProjectManager.getWorkspaceFolderQtInsRoot(folder);
          if (currentQtInsRoot !== previousQtInsRoot) {
            void this.stateManager.setQtInstallationRoot(currentQtInsRoot);
            onQtInsRootUpdated(currentQtInsRoot, folder);
          }
        }
      )
    );
  }

  dispose() {
    logger.info('Disposing project:', this._folder.uri.fsPath);
  }
}

export class ProjectManager {
  globalStateManager: GlobalStateManager;
  projects = new Set<Project>();
  workspaceFile: vscode.Uri | undefined;
  constructor(readonly context: vscode.ExtensionContext) {
    this.globalStateManager = new GlobalStateManager(context);
    this.watchGlobalConfig(context);
    this.watchProjects(context);
  }
  private watchGlobalConfig(context: vscode.ExtensionContext) {
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(
        (e: vscode.ConfigurationChangeEvent) => {
          void e;
          const previousQtInsRoot =
            this.globalStateManager.getQtInstallationRoot();
          const currentQtInsRoot = getCurrentGlobalQtInstallationRoot();
          if (currentQtInsRoot !== previousQtInsRoot) {
            void this.globalStateManager.setQtInstallationRoot(
              currentQtInsRoot
            );
            onQtInsRootUpdated(currentQtInsRoot, GlobalWorkspace);
          }
        }
      )
    );
  }
  public static getWorkspaceFolderQtInsRoot(folder: vscode.WorkspaceFolder) {
    const qtInsRootConfig =
      getConfiguration(folder).inspect<string>(QtInsRootConfigName);
    return qtInsRootConfig?.workspaceFolderValue ?? '';
  }
  public addWorkspaceFile(workspaceFile: vscode.Uri) {
    this.workspaceFile = workspaceFile;
    this.watchWorkspaceFileConfig(this.context);
  }
  private getWorkspaceFileQtInsRoot() {
    const qtInsRootConfig = getConfiguration(
      this.workspaceFile
    ).inspect<string>(QtInsRootConfigName);
    return qtInsRootConfig?.workspaceValue ?? '';
  }
  private watchWorkspaceFileConfig(context: vscode.ExtensionContext) {
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(
        (e: vscode.ConfigurationChangeEvent) => {
          void e;
          if (this.getWorkspaceFileQtInsRoot() !== '') {
            void vscode.window.showWarningMessage(
              `Qt installation root specified in workspace file is not supported.`
            );
          }
        }
      )
    );
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
    vscode.workspace.onDidChangeWorkspaceFolders((event) => {
      for (const folder of event.removed) {
        const project = this.getProject(folder);
        if (!project) {
          continue;
        }
        project.dispose();
        this.projects.delete(project);
        // kitManager.removeProject(project);
      }
      for (const folder of event.added) {
        const project = Project.createProject(folder, context);
        this.projects.add(project);
        // kitManager.addProject(project);
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
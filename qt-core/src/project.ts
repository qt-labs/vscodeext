// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import {
  AdditionalQtPathsName,
  createLogger,
  GlobalWorkspace,
  isEqualArrays,
  QtInsRootConfigName,
  QtAdditionalPath,
  compareQtAdditionalPath
} from 'qt-lib';
import { ProjectBase } from 'qt-lib';
import { convertAdditionalQtPaths, getConfiguration } from '@/util';
import { GlobalStateManager, WorkspaceStateManager } from '@/state';
import {
  getCurrentGlobalQtInstallationRoot,
  getCurrentGlobalAdditionalQtPaths,
  onQtInsRootUpdated,
  onAdditionalQtPathsUpdated
} from '@/installation-root';

const logger = createLogger('project');

// Project class represents a workspace folder in the extension.
export class CoreProject implements ProjectBase {
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
    return new CoreProject(folder, context);
  }
  get stateManager() {
    return this._stateManager;
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
          const previousAdditionalQtPaths =
            this.stateManager.getAdditionalQtPaths();
          const currentAdditionalQtPaths =
            ProjectManager.getWorkspaceFolderAdditionalQtPaths(folder);
          // TODO: Implement generic array comparison function

          if (
            !isEqualArrays(
              currentAdditionalQtPaths.sort(),
              previousAdditionalQtPaths.sort()
            )
          ) {
            void this.stateManager.setAdditionalQtPaths(
              currentAdditionalQtPaths
            );
            onAdditionalQtPathsUpdated(currentAdditionalQtPaths, folder);
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
  projects = new Set<CoreProject>();
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
          const previousAdditionalQtPaths =
            this.globalStateManager.getAdditionalQtPaths();
          const currentAdditionalQtPaths = getCurrentGlobalAdditionalQtPaths();
          if (
            !isEqualArrays(
              currentAdditionalQtPaths.sort(compareQtAdditionalPath),
              previousAdditionalQtPaths.sort(compareQtAdditionalPath)
            )
          ) {
            void this.globalStateManager.setAdditionalQtPaths(
              currentAdditionalQtPaths
            );
            onAdditionalQtPathsUpdated(
              currentAdditionalQtPaths,
              GlobalWorkspace
            );
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

  public static getWorkspaceFolderAdditionalQtPaths(
    folder: vscode.WorkspaceFolder
  ): QtAdditionalPath[] {
    const config = getConfiguration(folder).inspect<(string | object)[]>(
      AdditionalQtPathsName
    );
    if (config?.workspaceFolderValue) {
      return convertAdditionalQtPaths(config.workspaceFolderValue);
    }
    return [];
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
  private getWorkspaceFileQtAdditionalPaths() {
    const additionalQtPaths = getConfiguration(
      this.workspaceFile
    ).inspect<string>(AdditionalQtPathsName);
    return additionalQtPaths?.workspaceValue ?? '';
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
          if (this.getWorkspaceFileQtAdditionalPaths() !== '') {
            void vscode.window.showWarningMessage(
              `Additional Qt paths specified in workspace file are not supported.`
            );
          }
        }
      )
    );
  }
  public addProject(project: CoreProject) {
    logger.info('Adding project:', project.folder.uri.fsPath);
    this.projects.add(project);
  }
  public getProjects() {
    return this.projects;
  }
  public getProject(folder: vscode.WorkspaceFolder) {
    return Array.from(this.projects).find(
      (project) => project.folder === folder
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
      }
      for (const folder of event.added) {
        const project = CoreProject.createProject(folder, context);
        this.projects.add(project);
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

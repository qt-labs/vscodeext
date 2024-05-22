// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as fs from 'fs';

import { WorkspaceStateManager } from '@/state';
import { kitManager } from '@/extension';
import { DesignerClient } from '@/designer-client';
import { DesignerServer } from '@/designer-server';
import { getQtDesignerPath } from '@/util/get-qt-paths';
import { createLogger } from '@/logger';

const logger = createLogger('project');

// Project class represents a workspace folder in the extension.
export class Project {
  private readonly _stateManager: WorkspaceStateManager;
  private _designerClient: DesignerClient | undefined;
  private readonly _designerServer: DesignerServer;
  private constructor(
    private readonly _folder: vscode.WorkspaceFolder,
    readonly _context: vscode.ExtensionContext,
    designerExePath: string
  ) {
    this._stateManager = new WorkspaceStateManager(_context, _folder);
    this._designerServer = new DesignerServer();
    // If a kit is selected, create a DesignerClient instance. Otherwise,
    // the DesignerClient instance will be created when the user opens a .ui
    // file and a kit is selected. `cmake.onSelectedKitChanged()` api is needed
    // to create a DesignerClient instance when a kit is selected instead of
    // waiting for the user to open a .ui file.
    if (designerExePath) {
      this._designerClient = new DesignerClient(
        designerExePath,
        this._designerServer.getPort()
      );
    }
    const customWidgetsDesignerExePath = vscode.workspace
      .getConfiguration('qt-official', this._folder)
      .get<string>('customWidgetsDesignerExePath', '');
    logger.info(
      `customWidgetsDesignerExePath: "${customWidgetsDesignerExePath}"`
    );
    if (customWidgetsDesignerExePath) {
      if (Project.checkCustomDesignerExePath(customWidgetsDesignerExePath)) {
        this._designerClient = new DesignerClient(
          customWidgetsDesignerExePath,
          this._designerServer.getPort()
        );
      }
    }
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (
        event.affectsConfiguration(
          'qt-official.customWidgetsDesignerExePath',
          this._folder
        )
      ) {
        const customWidgetsDesignerExePathConfig = vscode.workspace
          .getConfiguration('qt-official', this._folder)
          .get<string>('customWidgetsDesignerExePath', '');
        logger.info(
          'new customWidgetsDesignerExePath:',
          customWidgetsDesignerExePathConfig
        );
        if (
          customWidgetsDesignerExePathConfig &&
          Project.checkCustomDesignerExePath(customWidgetsDesignerExePathConfig)
        ) {
          this._designerClient?.detach();
          this._designerClient = new DesignerClient(
            customWidgetsDesignerExePathConfig,
            this._designerServer.getPort()
          );
        } else {
          if (this._designerClient) {
            this._designerClient.detach();
            this._designerClient = new DesignerClient(
              await getQtDesignerPath(this._folder),
              this._designerServer.getPort()
            );
          }
        }
      }
    });
  }

  static async createProject(
    folder: vscode.WorkspaceFolder,
    context: vscode.ExtensionContext
  ) {
    logger.info('Creating project:"' + folder.uri.fsPath + '"');
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
  set designerClient(client: DesignerClient | undefined) {
    this._designerClient = client;
  }
  get folder() {
    return this._folder;
  }

  private static checkCustomDesignerExePath(
    customWidgetsDesignerExePath: string
  ) {
    if (!fs.existsSync(customWidgetsDesignerExePath)) {
      logger.error(
        'Qt Widgets Designer executable not found at:"',
        customWidgetsDesignerExePath,
        '"'
      );
      void vscode.window.showWarningMessage(
        'Qt Widgets Designer executable not found at:"' +
          customWidgetsDesignerExePath +
          '"'
      );
      return false;
    }
    return true;
  }
  dispose() {
    this._designerServer.dispose();
    this._designerClient?.dispose();
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

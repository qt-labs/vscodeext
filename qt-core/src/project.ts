// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import { isEmpty, isEqual } from 'lodash';

import {
  AdditionalQtPathsName,
  createLogger,
  GlobalWorkspace,
  QtInsRootConfigName,
  QtAdditionalPath,
  compareQtAdditionalPath,
  telemetry,
  resolveConfiguration
} from 'qt-lib';
import { Project, ProjectManager } from 'qt-lib';
import { convertAdditionalQtPaths, getConfiguration } from '@/util';
import { GlobalStateManager, WorkspaceStateManager } from '@/state';
import {
  getCurrentGlobalQtInstallationRoot,
  getCurrentGlobalAdditionalQtPaths,
  onQtInsRootUpdated,
  onAdditionalQtPathsUpdated
} from '@/installation-root';
import { coreAPI } from '@/extension';

const logger = createLogger('project');

export async function createCoreProject(
  folder: vscode.WorkspaceFolder,
  context: vscode.ExtensionContext
) {
  logger.info('Creating project:"' + folder.uri.fsPath + '"');
  return Promise.resolve(new CoreProject(folder, context));
}

// Project class represents a workspace folder in the extension.
export class CoreProject implements Project {
  private readonly _disposables: vscode.Disposable[] = [];
  private readonly _stateManager: WorkspaceStateManager;
  private _qtInstallationRoot: string | undefined;
  constructor(
    private readonly _folder: vscode.WorkspaceFolder,
    readonly _context: vscode.ExtensionContext
  ) {
    this._stateManager = new WorkspaceStateManager(_context, _folder);
    this.watchWorkspaceFolderConfig(_folder);
  }
  set qtInstallationRoot(value: string) {
    this._qtInstallationRoot = value;
  }
  get qtInstallationRoot() {
    return this._qtInstallationRoot ?? '';
  }
  get stateManager() {
    return this._stateManager;
  }
  get folder() {
    return this._folder;
  }

  public async reset() {
    return this.stateManager.reset();
  }

  private watchWorkspaceFolderConfig(folder: vscode.WorkspaceFolder) {
    const eventHandler = vscode.workspace.onDidChangeConfiguration(
      (e: vscode.ConfigurationChangeEvent) => {
        void e;
        const previousQtInsRoot = this.stateManager.getQtInstallationRoot();
        const currentQtInsRoot =
          CoreProjectManager.getWorkspaceFolderQtInsRoot(folder);
        if (currentQtInsRoot !== previousQtInsRoot) {
          void this.stateManager.setQtInstallationRoot(currentQtInsRoot);
          onQtInsRootUpdated(currentQtInsRoot, folder);
        }
        const previousAdditionalQtPaths =
          this.stateManager.getAdditionalQtPaths();
        const currentAdditionalQtPaths =
          CoreProjectManager.getWorkspaceFolderAdditionalQtPaths(folder);

        if (
          !isEqual(
            currentAdditionalQtPaths.sort(),
            previousAdditionalQtPaths.sort()
          )
        ) {
          void this.stateManager.setAdditionalQtPaths(currentAdditionalQtPaths);
          onAdditionalQtPathsUpdated(currentAdditionalQtPaths, folder);
        }
      }
    );
    this._disposables.push(eventHandler);
  }

  public initConfigValues() {
    const folder = this.folder;
    const qtInsRoot = CoreProjectManager.getWorkspaceFolderQtInsRoot(folder);
    coreAPI?.setValue(folder, QtInsRootConfigName, qtInsRoot);
    logger.info(
      `Setting Qt installation root for ${folder.uri.fsPath} to: ${qtInsRoot}`
    );
    const additionalQtPaths =
      CoreProjectManager.getWorkspaceFolderAdditionalQtPaths(folder);
    coreAPI?.setValue(folder, AdditionalQtPathsName, additionalQtPaths);
    logger.info(
      `Setting additional Qt paths for ${folder.uri.fsPath} to: ${additionalQtPaths.join(', ')}`
    );
    logger.info('Config values initialized for:', folder.uri.fsPath);
    if (!isEmpty(additionalQtPaths)) {
      telemetry.sendEvent('additionalQtPathsUsedWorkspace');
    }
  }

  dispose() {
    logger.info('Disposing project:', this._folder.uri.fsPath);
    for (const d of this._disposables) {
      d.dispose();
    }
  }
}

export class CoreProjectManager extends ProjectManager<CoreProject> {
  globalStateManager: GlobalStateManager;
  workspaceFile: vscode.Uri | undefined;
  constructor(override readonly context: vscode.ExtensionContext) {
    super(context, createCoreProject);
    this.globalStateManager = new GlobalStateManager(context);
    this.watchGlobalConfig();

    this.onProjectAdded((project: CoreProject) => {
      logger.info('Adding project:', project.folder.uri.fsPath);
      project.initConfigValues();
    });
  }
  private watchGlobalConfig() {
    this._disposables.push(
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
            !isEqual(
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
    const workspaceFolderValue = qtInsRootConfig?.workspaceFolderValue;
    return workspaceFolderValue
      ? resolveConfiguration(workspaceFolderValue)
      : '';
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
  public reset() {
    void this.globalStateManager.reset();
    for (const project of this.projects) {
      void project.reset();
    }
  }
}

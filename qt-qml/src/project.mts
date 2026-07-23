// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import {
  CoreKey,
  Project,
  ProjectManager,
  createLogger,
  QtWorkspaceFeatures,
  getPySideApi,
  PySideProject,
  getQtBridgeCSharpApi,
  type QtBridgeCSharpAPI,
  type QtBridgeProject
} from 'qt-lib';
import { Qmlls } from '@/qmlls.mjs';
import {
  aggregateQtBridgeQmllsProjects,
  type QtBridgeQmllsAggregation
} from '@/qtbridge-qmlls-update.mjs';
import { coreAPI } from '@/extension.mjs';
import { QmllsOperationQueue, QmllsOperationType } from '@/qmlls-queue.mjs';

const logger = createLogger('project');
let qtBridgeApi: QtBridgeCSharpAPI | undefined;

export async function createQMLProject(
  folder: vscode.WorkspaceFolder,
  context: vscode.ExtensionContext
) {
  return Promise.resolve(new QMLProject(folder, context));
}

export class QMLProjectManager extends ProjectManager<QMLProject> {
  private readonly _qmllsQueue = new QmllsOperationQueue();

  constructor(override readonly context: vscode.ExtensionContext) {
    super(context, createQMLProject);
    this.onProjectAdded((project) => {
      void this.initializeProject(project);
    });
  }

  async initializeQtBridgeIntegration() {
    qtBridgeApi = await getQtBridgeCSharpApi();
    if (!qtBridgeApi) {
      logger.info('Qt Bridge C# extension API is unavailable');
      return;
    }
    this._disposables.push(
      qtBridgeApi.onDidChangeProjects(() => {
        void this.handleQtBridgeProjectsChanged();
      }),
      qtBridgeApi.onDidChangeMetadata(() => {
        void this.handleQtBridgeProjectsChanged();
      })
    );
  }

  private async handleQtBridgeProjectsChanged() {
    logger.info('Qt Bridge project state changed');
    for (const project of this.getProjects()) {
      await project.handleQtBridgeProjectSignal();
    }
  }

  async initializeProject(project: QMLProject) {
    logger.info('Initializing project:', project.folder.uri.fsPath);
    project.getConfigValues();
    project.refreshQtBridgeProject();
    project.updateQmllsParams();
    await this.startQmllsForProject(project);
  }

  /**
   * Get the QMLLS operation queue for serializing operations.
   */
  get qmllsQueue() {
    return this._qmllsQueue;
  }

  /**
   * Start qmlls for a single project through the queue.
   */
  private async startQmllsForProject(project: QMLProject) {
    return this._qmllsQueue.enqueue(QmllsOperationType.Start, async () => {
      await project.qmlls.start();
    });
  }

  /**
   * Start all qmlls instances through the queue.
   */
  async startQmlls() {
    return this._qmllsQueue.enqueue(QmllsOperationType.Start, async () => {
      const promises = [];
      for (const project of this.getProjects()) {
        promises.push(project.qmlls.start());
      }
      return Promise.all(promises);
    });
  }

  /**
   * Restart all qmlls instances through the queue.
   */
  async restartQmlls() {
    return this._qmllsQueue.enqueue(QmllsOperationType.Restart, async () => {
      const promises = [];
      for (const project of this.getProjects()) {
        promises.push(project.qmlls._restartInternal());
      }
      return Promise.all(promises);
    });
  }
  updateQmllsParams() {
    for (const project of this.getProjects()) {
      project.updateQmllsParams();
    }
  }
  getConfigValues() {
    for (const project of this.getProjects()) {
      project.getConfigValues();
    }
  }
  getBuildDirs() {
    const buildDirs = [];
    for (const project of this.getProjects()) {
      if (project.buildDir) {
        buildDirs.push(project.buildDir);
      }
    }
    return buildDirs;
  }
}
// Project class represents a workspace folder in the extension.
export class QMLProject implements Project {
  _qmlls: Qmlls;
  _qtpathsExe: string | undefined;
  _kitPath: string | undefined;
  _buildDir: string | undefined;
  _pySideProject?: PySideProject | undefined;
  _qtBridgeProjects: readonly QtBridgeProject[] = [];
  private _qtBridgeQmllsAggregation: QtBridgeQmllsAggregation =
    aggregateQtBridgeQmllsProjects([]);
  public constructor(
    readonly _folder: vscode.WorkspaceFolder,
    readonly _context: vscode.ExtensionContext
  ) {
    logger.info('Creating project:', _folder.uri.fsPath);
    this._qmlls = new Qmlls(_folder);
  }
  async startQmlls() {
    return this.qmlls.start();
  }

  /**
   * Restart qmlls for this project (goes through the queue).
   */
  async restartQmlls() {
    return this.qmlls.restart();
  }
  get qtpathsExe() {
    return this._qtpathsExe;
  }
  set qtpathsExe(qtpathsExe: string | undefined) {
    this._qtpathsExe = qtpathsExe;
  }

  get pySideProject() {
    return this._pySideProject;
  }

  public async initPySideProject() {
    const api = await getPySideApi();
    this._pySideProject = api?.getProject(this._folder);
    if (!this._pySideProject) {
      logger.info(
        `No PySide project available for: ${this._folder.uri.fsPath}`
      );
    }
  }

  refreshQtBridgeProject() {
    const project = qtBridgeApi?.getProject(this.folder);
    const projects = project ? [project] : [];
    this._qtBridgeProjects = projects;
    this._qtBridgeQmllsAggregation =
      aggregateQtBridgeQmllsProjects(projects);
    logger.info(
      `Qt Bridge project detection result for ${this.folder.uri.fsPath}: `
        + `projects=${String(projects.length)}; `
        + `readyQmllsProjects=${String(this._qtBridgeQmllsAggregation.sessionConfigs.length)}`
    );
  }

  async handleQtBridgeProjectSignal() {
    const previousState = this._qtBridgeQmllsAggregation.stateKey;
    this.refreshQtBridgeProject();
    const currentState = this._qtBridgeQmllsAggregation.stateKey;
    if (previousState === currentState) {
      return;
    }
    this.updateQmllsParams();
    await this.restartQmlls();
  }

  getConfigValues() {
    this.qtpathsExe = coreAPI?.getValue<string>(
      this.folder,
      CoreKey.SELECTED_QT_PATHS
    );
    this.buildDir = coreAPI?.getValue<string>(this.folder, CoreKey.BUILD_DIR);

    const features = coreAPI?.getValue<QtWorkspaceFeatures>(
      this.folder,
      CoreKey.WORKSPACE_FEATURES
    );
    logger.info(
      `Project config for ${this.folder.uri.fsPath}: `
        + `qtpathsExe=${this.qtpathsExe ?? '<none>'}; `
        + `buildDir=${this._buildDir ?? '<none>'}; `
        + `pyside=${String(features?.projectTypes.pyside === true)}`
    );
    if (features?.projectTypes.pyside === true && !this._pySideProject) {
      void this.initPySideProject();
    }
  }

  updateQmllsParams() {
    this.qmlls.clearImportPaths();
    this.qmlls.docsPath = undefined;
    this.qmlls.useNoCMakeCalls = false;
    this.qmlls.buildDir = this._buildDir;
    const aggregation = this._qtBridgeQmllsAggregation;
    this.qmlls.qtBridgeSessionConfigs = aggregation.sessionConfigs;
    this.qmlls.useNoCMakeCalls = aggregation.useNoCMakeCalls;
    if (aggregation.startupBuildDir) {
      this.qmlls.buildDir = aggregation.startupBuildDir;
    }
    for (const importPath of aggregation.importPaths) {
      this.qmlls.addImportPath(importPath);
    }
    logger.info(
      `Applying Qt Bridge qmlls aggregation for ${this.folder.uri.fsPath}: `
        + `projects=${String(this._qtBridgeProjects.length)}; `
        + `sessions=${String(aggregation.sessionConfigs.length)}; `
        + `imports=${String(aggregation.importPaths.length)}`
    );

    if (this.qtpathsExe) {
      const info = coreAPI?.getQtInfoFromPath(this.qtpathsExe).info;
      if (!info) {
        throw new Error('Cannot find Qt info');
      }
      const qmlImportPath = info.get('QT_INSTALL_QML');
      if (!qmlImportPath) {
        throw new Error('Cannot find QT_INSTALL_QML');
      }
      logger.info(
        `Adding Qt import root from selected Qt path for ${this.folder.uri.fsPath}: `
          + qmlImportPath
      );
      this.qmlls.addImportPath(qmlImportPath);
      const docsPath = info.get('QT_INSTALL_DOCS');
      if (docsPath) {
        logger.info('Setting docs path:', docsPath);
        this.qmlls.docsPath = docsPath;
      }
    }
  }
  set buildDir(buildDir: string | undefined) {
    this._buildDir = buildDir;
    this.qmlls.buildDir = buildDir;
  }
  get buildDir() {
    return this._buildDir;
  }
  get folder() {
    return this._folder;
  }
  get qmlls() {
    return this._qmlls;
  }
  dispose() {
    logger.info('Disposing project:', this.folder.uri.fsPath);
    this.qmlls.dispose();
  }
}

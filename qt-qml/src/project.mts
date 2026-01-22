// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { CoreKey, Project, ProjectManager, createLogger } from 'qt-lib';
import { Qmlls } from '@/qmlls.mjs';
import { coreAPI } from '@/extension.mjs';
import { QmllsOperationQueue, QmllsOperationType } from '@/qmlls-queue.mjs';

const logger = createLogger('project');

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
      logger.info('Adding project:', project.folder.uri.fsPath);
      project.getConfigValues();
      project.updateQmllsParams();
      void this.startQmllsForProject(project);
    });
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
   * Stop all qmlls instances. This is called internally during install,
   * so it does NOT go through the queue to avoid deadlock.
   */
  async stopQmlls() {
    return this._qmllsQueue.enqueue(QmllsOperationType.Stop, async () => {
      const promises = [];
      for (const project of this.getProjects()) {
        promises.push(project.qmlls.stop());
      }
      return Promise.all(promises);
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

  getConfigValues() {
    this.qtpathsExe = coreAPI?.getValue<string>(
      this.folder,
      CoreKey.SELECTED_QT_PATHS
    );
    this.buildDir = coreAPI?.getValue<string>(this.folder, CoreKey.BUILD_DIR);
  }

  updateQmllsParams() {
    this.qmlls.clearImportPaths();
    this.qmlls.docsPath = undefined;
    if (this.qtpathsExe) {
      const info = coreAPI?.getQtInfoFromPath(this.qtpathsExe);
      if (!info) {
        throw new Error('Cannot find Qt info');
      }
      const qmlImportPath = info.get('QT_INSTALL_QML');
      if (!qmlImportPath) {
        throw new Error('Cannot find QT_INSTALL_QML');
      }
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

// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import path from 'path';

import {
  Project,
  ProjectManager,
  createLogger,
  findQtPathsInKitDir
} from 'qt-lib';
import { Qmlls } from '@/qmlls';
import { coreAPI } from '@/extension';

const logger = createLogger('project');

export async function createQMLProject(
  folder: vscode.WorkspaceFolder,
  context: vscode.ExtensionContext
) {
  return Promise.resolve(new QMLProject(folder, context));
}

export class QMLProjectManager extends ProjectManager<QMLProject> {
  constructor(override readonly context: vscode.ExtensionContext) {
    super(context, createQMLProject);
    this.onProjectAdded((project) => {
      logger.info('Adding project:', project.folder.uri.fsPath);
      project.getConfigValues();
      project.updateQmllsParams();
      void project.qmlls.start();
    });
  }
  async stopQmlls() {
    const promises = [];
    for (const project of this.getProjects()) {
      promises.push(project.qmlls.stop());
    }
    return Promise.all(promises);
  }
  async startQmlls() {
    const promises = [];
    for (const project of this.getProjects()) {
      promises.push(project.qmlls.start());
    }
    return Promise.all(promises);
  }
  async restartQmlls() {
    const promises = [];
    for (const project of this.getProjects()) {
      promises.push(project.qmlls.restart());
    }
    return Promise.all(promises);
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
  get kitPath() {
    return this._kitPath;
  }
  set kitPath(kitPath: string | undefined) {
    this._kitPath = kitPath;
  }
  get qtpathsExe() {
    return this._qtpathsExe;
  }
  set qtpathsExe(qtpathsExe: string | undefined) {
    this._qtpathsExe = qtpathsExe;
  }

  getConfigValues() {
    this.kitPath = coreAPI?.getValue<string>(this.folder, 'selectedKitPath');
    this.qtpathsExe = coreAPI?.getValue<string>(this.folder, 'selectedQtPaths');
    this.buildDir = coreAPI?.getValue<string>(this.folder, 'buildDir');
  }
  getDocsPathFromKitDir(kitDir: string) {
    const qtpaths = findQtPathsInKitDir(kitDir);
    if (!qtpaths) {
      logger.error(`Cannot find qtpaths in: ${this.kitPath}`);
      return undefined;
    }
    const qtInfo = coreAPI?.getQtInfoFromPath(qtpaths);
    if (!qtInfo) {
      logger.error('Cannot find qtInfo');
      return undefined;
    }
    return qtInfo.get('QT_INSTALL_DOCS');
  }

  updateQmllsParams() {
    this.qmlls.clearImportPaths();
    if (this.kitPath) {
      this.qmlls.addImportPath(path.join(this.kitPath, 'qml'));
      const docsPath = this.getDocsPathFromKitDir(this.kitPath);
      if (docsPath) {
        logger.info('Setting docs path:', docsPath);
        this.qmlls.docsPath = docsPath;
      }
    } else if (this.qtpathsExe) {
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

// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { ProjectManager, createLogger, QtWorkspaceType } from 'qt-lib';
import { PySideProject } from './project';
import { pyApi, coreApi } from './extension';
import * as consts from '@/constants';

type Context = vscode.ExtensionContext;

const logger = createLogger('project-manager');

export class PySideProjectManager extends ProjectManager<PySideProject> {
  constructor(override readonly context: Context) {
    super(context, PySideProject.create);
    this._disposables.push(this.onProjectAdded(this._onProjectAdded));
  }

  public async init() {
    const folders = vscode.workspace.workspaceFolders ?? [];

    for (const folder of folders) {
      const p = await PySideProject.create(folder, this.context);
      await this._onProjectAdded(p);
      this.addProject(p);
    }
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  private readonly _onProjectAdded = async (p: PySideProject) => {
    await p.refreshEnv(pyApi);
    p.refreshInfo();
    updateCoreValues(p);
  };
}

// helpers
function updateCoreValues(p: PySideProject) {
  if (!coreApi) {
    logger.error('CoreAPI is not initialized');
    return;
  }

  const fsPath = p.folder.uri.fsPath;

  if (p.isValid()) {
    coreApi.setValue(
      p.folder,
      consts.CORE_API_KEY_WORKSPACE_TYPE,
      QtWorkspaceType.PythonExt
    );

    logger.info(`Set workspace type to Python: "${fsPath}"`);
    return;
  }

  logger.info(`Not a PySide6 project: "${fsPath}"`);
}

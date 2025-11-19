// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { ProjectManager } from 'qt-lib';
import { PySideProject } from './project';

export class PySideProjectManager extends ProjectManager<PySideProject> {
  constructor(override readonly context: vscode.ExtensionContext) {
    super(context, PySideProject.create);
    this._disposables.push(
      this.onProjectAdded(PySideProjectManager._onProjectAdded)
    );
  }

  public async init() {
    const folders = vscode.workspace.workspaceFolders ?? [];

    for (const folder of folders) {
      const p = await PySideProject.create(folder, this.context);
      this.addProject(p);
      await PySideProjectManager._onProjectAdded(p);
    }
  }

  public async refreshProjectEnv(folder: vscode.WorkspaceFolder) {
    await this.getProject(folder)?.refreshEnv();
  }

  private static readonly _onProjectAdded = async (p: PySideProject) => {
    p.refreshInfo();
    await p.refreshEnv();
  };
}

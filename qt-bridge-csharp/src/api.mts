// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import { type QtBridgeCSharpAPI, type QtBridgeProject } from 'qt-lib';

export class QtBridgeCSharpApi implements QtBridgeCSharpAPI, vscode.Disposable {
  private readonly projects: readonly QtBridgeProject[] = [];
  private readonly projectsChanged = new vscode.EventEmitter<void>();

  readonly onDidChangeProjects = this.projectsChanged.event;

  getProjects(): readonly QtBridgeProject[] {
    return this.projects;
  }

  getProject(folder: vscode.WorkspaceFolder): QtBridgeProject | undefined {
    return this.projects.find(
      (project) => project.folder.uri.toString() === folder.uri.toString()
    );
  }

  getProjectForUri(uri: vscode.Uri): QtBridgeProject | undefined {
    return this.projects.find(
      (project) => project.projectFile.toString() === uri.toString()
    );
  }

  dispose() {
    this.projectsChanged.dispose();
  }
}

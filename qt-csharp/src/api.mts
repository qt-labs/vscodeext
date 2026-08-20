// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import { type QtBridgeCSharpAPI, type QtBridgeProject } from 'qt-lib';
import { QtBridgeProjectManager } from '@/project-manager.mjs';

export class QtBridgeCSharpApi implements QtBridgeCSharpAPI, vscode.Disposable {
  private readonly projectManager = new QtBridgeProjectManager();

  readonly onDidChangeProjects = this.projectManager.onDidChangeProjects;
  readonly onDidChangeMetadata = this.projectManager.onDidChangeMetadata;

  async initialize(workspaceState?: vscode.Memento): Promise<void> {
    await this.projectManager.initialize(workspaceState);
  }

  getProjects(): readonly QtBridgeProject[] {
    return this.projectManager.getProjects();
  }

  getProject(folder: vscode.WorkspaceFolder): QtBridgeProject | undefined {
    return this.projectManager.getProject(folder);
  }

  getProjectForUri(uri: vscode.Uri): QtBridgeProject | undefined {
    return this.projectManager.getProjectForUri(uri);
  }

  async selectMetadata(): Promise<void> {
    await this.projectManager.selectMetadata();
  }

  dispose() {
    this.projectManager.dispose();
  }
}

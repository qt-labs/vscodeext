// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import * as vscode from 'vscode';
import type { QtBridgeProject } from 'qt-lib';
import { getQtBridgeProjects, getQtBridgeProjectForUri } from '@/project.mjs';

const defaultServices = {
  getProjects: getQtBridgeProjects,
  getProjectForUri: getQtBridgeProjectForUri,
  getWorkspaceFolder: vscode.workspace.getWorkspaceFolder,
  pickProject: showQtBridgeProjectPicker
};

export async function selectQtBridgePreviewProject(
  folder: vscode.WorkspaceFolder,
  activeUri: vscode.Uri | undefined,
  services = defaultServices,
  pickerTitle?: string
): Promise<QtBridgeProject | undefined> {
  const projects = services.getProjects(folder);
  if (projects.length === 0) {
    return undefined;
  }

  const activeFolder = activeUri
    ? services.getWorkspaceFolder(activeUri)
    : undefined;
  if (activeUri && activeFolder?.uri.toString() === folder.uri.toString()) {
    const activeProject = services.getProjectForUri(activeUri);
    if (
      activeProject &&
      projects.some(
        (project) =>
          project.projectFile.toString() ===
          activeProject.projectFile.toString()
      )
    ) {
      return activeProject;
    }
  }

  if (projects.length === 1) {
    return projects[0];
  }

  if (pickerTitle) {
    return showQtBridgeProjectPicker(projects, pickerTitle);
  }
  return services.pickProject(projects);
}

async function showQtBridgeProjectPicker(
  projects: readonly QtBridgeProject[],
  title = 'QML Preview - select Qt Bridge project'
): Promise<QtBridgeProject | undefined> {
  const selection = await vscode.window.showQuickPick(
    projects.map((project) => ({
      label: path.basename(project.projectFile.fsPath),
      description: vscode.workspace.asRelativePath(project.projectFile, false),
      project
    })),
    {
      placeHolder: 'Select the Qt Bridge project for QML Preview',
      title
    }
  );
  return selection?.project;
}

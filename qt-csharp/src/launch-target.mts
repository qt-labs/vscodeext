// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { QtBridgeCSharpAPI, QtBridgeProject } from 'qt-lib';

const defaultServices = {
  getActiveUri: () => vscode.window.activeTextEditor?.document.uri,
  async pickProject(projects: readonly QtBridgeProject[]) {
    const selection = await vscode.window.showQuickPick(
      projects.map((project) => ({
        label: path.basename(project.projectFile.fsPath),
        description: vscode.workspace.asRelativePath(
          project.projectFile,
          false
        ),
        project
      })),
      {
        title: 'Qt Bridge C#: Select launch target',
        placeHolder: 'Select the project to debug'
      }
    );
    return selection?.project;
  },
  showError(message: string) {
    void vscode.window.showErrorMessage(message);
  }
};

/** Resolve the built application host for a launch.json command variable. */
export async function resolveLaunchTargetPath(
  api: Pick<QtBridgeCSharpAPI, 'getProjects' | 'getProjectForUri'>,
  services = defaultServices
): Promise<string | undefined> {
  const projects = api.getProjects();
  if (projects.length === 0) {
    services.showError('No Qt Bridge C# project was found in the workspace.');
    return undefined;
  }

  const activeUri = services.getActiveUri();
  let project = activeUri ? api.getProjectForUri(activeUri) : undefined;
  project ??=
    projects.length === 1 ? projects[0] : await services.pickProject(projects);
  if (!project) {
    return undefined;
  }

  const application = project.metadata?.application;
  if (!application) {
    services.showError(
      `No application build metadata is selected for ${path.basename(project.projectFile.fsPath)}. ` +
        'Build the project first. If it has several builds, use ' +
        '"Qt Bridge C#: Select QML Build Metadata" to select one.'
    );
    return undefined;
  }

  // QML build readiness is not required to debug an existing application host.
  // Never use nativeHostPath: that file is an unpatched build template.
  const executable = application.managedHostPath;
  try {
    if ((await fs.promises.stat(executable)).isFile()) {
      return executable;
    }
  } catch {
    // The selected build may have been cleaned since metadata was discovered.
  }
  services.showError(
    `Qt Bridge application host not found: ${executable}. Build the project before debugging.`
  );
  return undefined;
}

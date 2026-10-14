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

export function isQtBridgePreviewAvailable(
  project: QtBridgeProject | undefined
): project is QtBridgeProject {
  return (
    project?.isMetadataReady === true &&
    project.metadata?.application !== undefined &&
    project.metadata.qml.files.length > 0
  );
}

export function getQtBridgePreviewProjects(
  projects: readonly QtBridgeProject[]
): QtBridgeProject[] {
  return projects.filter(isQtBridgePreviewAvailable);
}

export type QmlLaunchProjectType = 'bridge' | 'cmake' | 'pyside';

export interface QmlLaunchProjectFeatures {
  readonly pySideProject: boolean;
  readonly cmake: boolean;
  readonly pyside: boolean;
}

export interface QmlLaunchProject {
  readonly type: QmlLaunchProjectType | undefined;
  readonly bridgeProject?: QtBridgeProject;
}

/**
 * Decide how to launch QML Preview or QML Profiler for a workspace folder.
 *
 * Building a Qt Bridge project generates a CMake project below obj/, so a
 * Bridge folder can also be reported as a CMake project. A ready Bridge
 * project therefore wins over CMake and PySide, unless the active file
 * belongs to the folder but to none of its Bridge projects.
 *
 * A 'bridge' result without a project means that the folder has Bridge
 * projects, but none of them has been built yet.
 *
 * Returns undefined when the user cancelled the Bridge project selection.
 */
export async function resolveQmlLaunchProject(
  folder: vscode.WorkspaceFolder,
  activeUri: vscode.Uri | undefined,
  features: QmlLaunchProjectFeatures,
  services = defaultServices,
  pickerTitle?: string
): Promise<QmlLaunchProject | undefined> {
  if (features.pySideProject) {
    return { type: 'pyside' };
  }
  const otherType = features.cmake
    ? 'cmake'
    : features.pyside
      ? 'pyside'
      : undefined;

  const allProjects = services.getProjects(folder);
  const projects = getQtBridgePreviewProjects(allProjects);
  if (projects.length === 0) {
    // Bridge projects without build metadata cannot be launched yet. Report
    // them as Bridge projects so that the caller can ask for a build instead
    // of falling back to CMake.
    return {
      type: otherType ?? (allProjects.length > 0 ? 'bridge' : undefined)
    };
  }

  const activeProject = findActiveQtBridgePreviewProject(
    folder,
    activeUri,
    projects,
    services
  );
  if (activeProject) {
    return { type: 'bridge', bridgeProject: activeProject };
  }
  if (otherType && isUriInFolder(folder, activeUri, services)) {
    return { type: otherType };
  }

  const bridgeProject = await selectQtBridgePreviewProject(
    folder,
    activeUri,
    services,
    pickerTitle
  );
  if (!bridgeProject) {
    return undefined;
  }
  return { type: 'bridge', bridgeProject };
}

function isUriInFolder(
  folder: vscode.WorkspaceFolder,
  uri: vscode.Uri | undefined,
  services: typeof defaultServices
) {
  return (
    uri !== undefined &&
    services.getWorkspaceFolder(uri)?.uri.toString() === folder.uri.toString()
  );
}

function findActiveQtBridgePreviewProject(
  folder: vscode.WorkspaceFolder,
  activeUri: vscode.Uri | undefined,
  projects: readonly QtBridgeProject[],
  services: typeof defaultServices
) {
  if (!activeUri || !isUriInFolder(folder, activeUri, services)) {
    return undefined;
  }
  const activeProject = services.getProjectForUri(activeUri);
  if (
    activeProject &&
    projects.some(
      (project) =>
        project.projectFile.toString() === activeProject.projectFile.toString()
    )
  ) {
    return activeProject;
  }
  return undefined;
}

export async function selectQtBridgePreviewProject(
  folder: vscode.WorkspaceFolder,
  activeUri: vscode.Uri | undefined,
  services = defaultServices,
  pickerTitle?: string
): Promise<QtBridgeProject | undefined> {
  const projects = getQtBridgePreviewProjects(services.getProjects(folder));
  if (projects.length === 0) {
    return undefined;
  }

  const activeProject = findActiveQtBridgePreviewProject(
    folder,
    activeUri,
    projects,
    services
  );
  if (activeProject) {
    return activeProject;
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

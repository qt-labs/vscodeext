// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import type { QtBridgeProject, QtBridgeQmlMetadata } from 'qt-lib';
import { getQtBridgeProjects, getQtBridgeProjectForUri } from '@/project.mjs';
import { normalizePathForComparison } from '@/utils.mjs';

/**
 * Map the copies of a Qt Bridge project's QML files back to their sources.
 *
 * The Bridge build copies the QML files below obj/ and into the build
 * output, and the preview runs a staged copy of the build output. Requests
 * for these copies are answered with the sources, so that the preview shows
 * the current QML without a rebuild and watches the files the user edits.
 */
export function createQtBridgeSourceRedirect(
  metadata: QtBridgeQmlMetadata,
  stagedDir: string
): (localPath: string) => string | undefined {
  const copyRoots = [stagedDir, path.join(metadata.qml.sourceDir, 'qml')];
  if (metadata.application) {
    copyRoots.push(metadata.application.managedOutputDir);
  }
  // Qt resolves symlinks in application paths (notably /var -> /private/var
  // on macOS). Register both spellings while preserving the editable source.
  for (const root of [...copyRoots]) {
    try {
      copyRoots.push(fs.realpathSync.native(root));
    } catch {
      // Build directories may not exist yet; the lexical mapping still works.
    }
  }
  const sources = new Map<string, string>();
  for (const file of metadata.qml.files) {
    const relativePath = path.join(
      file.modulePath,
      path.basename(file.sourcePath)
    );
    for (const root of copyRoots) {
      sources.set(
        normalizePathForComparison(path.join(root, relativePath)),
        file.sourcePath
      );
    }
  }
  return (localPath) => sources.get(normalizePathForComparison(localPath));
}

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

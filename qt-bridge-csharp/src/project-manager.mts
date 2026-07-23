// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import * as vscode from 'vscode';
import { createLogger, type QtBridgeProject } from 'qt-lib';
import { inspectQtBridgeProject, QtBridgeProjectSnapshot } from '@/project.mjs';

const logger = createLogger('project-manager');
const PROJECT_EXCLUDE_PATTERN =
  '**/{.git,.vs,bin,obj,node_modules,packages}/**';

function canonicalPath(filePath: string): string {
  const resolved = path.resolve(filePath);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function isGeneratedProject(uri: vscode.Uri): boolean {
  const segments = canonicalPath(uri.fsPath).split(path.sep);
  return segments.some((segment) =>
    ['.git', '.vs', 'bin', 'obj', 'node_modules', 'packages'].includes(segment)
  );
}

function projectState(projects: readonly QtBridgeProject[]): string {
  return JSON.stringify(
    projects.map((project) => ({
      projectFile: canonicalPath(project.projectFile.fsPath),
      packageId: project.packageId,
      packageVersion: project.packageVersion,
      qtDir: project.qtDir?.fsPath,
      qmlImportRoot: project.qmlImportRoot?.fsPath
    }))
  );
}

export class QtBridgeProjectManager implements vscode.Disposable {
  private readonly projects = new Map<string, QtBridgeProject>();
  private readonly folderWatchers = new Map<string, vscode.FileSystemWatcher>();
  private readonly refreshTimers = new Map<string, NodeJS.Timeout>();
  private readonly projectsChanged = new vscode.EventEmitter<void>();
  private readonly disposables: vscode.Disposable[] = [];

  readonly onDidChangeProjects = this.projectsChanged.event;

  constructor() {
    this.disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders((event) => {
        for (const folder of event.removed) {
          this.removeFolder(folder);
        }
        for (const folder of event.added) {
          this.watchFolder(folder);
          void this.refreshFolder(folder);
        }
      })
    );
  }

  async initialize(): Promise<void> {
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
      this.watchFolder(folder);
      await this.refreshFolder(folder, false);
    }
  }

  getProjects(): readonly QtBridgeProject[] {
    return [...this.projects.values()].sort((left, right) =>
      canonicalPath(left.projectFile.fsPath).localeCompare(
        canonicalPath(right.projectFile.fsPath)
      )
    );
  }

  getProject(folder: vscode.WorkspaceFolder): QtBridgeProject | undefined {
    const projects = this.getProjects().filter(
      (project) => project.folder.uri.toString() === folder.uri.toString()
    );
    return projects.length === 1 ? projects[0] : undefined;
  }

  getProjectForUri(uri: vscode.Uri): QtBridgeProject | undefined {
    if (uri.scheme !== 'file') {
      return undefined;
    }

    const candidatePath = canonicalPath(uri.fsPath);
    const exactProject = this.projects.get(candidatePath);
    if (exactProject) {
      return exactProject;
    }

    const containingProjects = this.getProjects()
      .filter((project) => {
        const projectDirectory = canonicalPath(
          path.dirname(project.projectFile.fsPath)
        );
        const relativePath = path.relative(projectDirectory, candidatePath);
        return (
          relativePath === '' ||
          (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
        );
      })
      .sort(
        (left, right) =>
          path.dirname(right.projectFile.fsPath).length -
          path.dirname(left.projectFile.fsPath).length
      );

    const closest = containingProjects[0];
    const next = containingProjects[1];
    if (
      closest &&
      next &&
      path.dirname(closest.projectFile.fsPath).length ===
        path.dirname(next.projectFile.fsPath).length
    ) {
      return undefined;
    }
    return closest;
  }

  async refreshFolder(
    folder: vscode.WorkspaceFolder,
    notify = true
  ): Promise<void> {
    const previousProjects = this.getProjectsForFolder(folder);
    const previousState = projectState(previousProjects);
    const projectFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(folder, '**/*.csproj'),
      PROJECT_EXCLUDE_PATTERN
    );
    const inspectedProjects = projectFiles.map((projectFile) =>
      inspectQtBridgeProject(projectFile)
    );

    for (const project of previousProjects) {
      this.projects.delete(canonicalPath(project.projectFile.fsPath));
    }

    for (let index = 0; index < projectFiles.length; ++index) {
      const projectFile = projectFiles[index];
      const info = inspectedProjects[index];
      if (!projectFile || !info) {
        continue;
      }
      const project = new QtBridgeProjectSnapshot(folder, info, async () => {
        await this.refreshFolder(folder);
      });
      this.projects.set(canonicalPath(projectFile.fsPath), project);
    }

    const currentProjects = this.getProjectsForFolder(folder);
    logger.info(
      `Qt Bridge discovery found ${String(currentProjects.length)} project(s) in ${folder.uri.fsPath}`
    );
    if (notify && previousState !== projectState(currentProjects)) {
      this.projectsChanged.fire();
    }
  }

  private getProjectsForFolder(
    folder: vscode.WorkspaceFolder
  ): readonly QtBridgeProject[] {
    return this.getProjects()
      .filter(
        (project) => project.folder.uri.toString() === folder.uri.toString()
      )
      .sort((left, right) =>
        canonicalPath(left.projectFile.fsPath).localeCompare(
          canonicalPath(right.projectFile.fsPath)
        )
      );
  }

  private watchFolder(folder: vscode.WorkspaceFolder) {
    const folderKey = folder.uri.toString();
    if (this.folderWatchers.has(folderKey)) {
      return;
    }

    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(folder, '**/*.csproj')
    );
    const scheduleRefresh = (uri: vscode.Uri) => {
      if (!isGeneratedProject(uri)) {
        this.scheduleRefresh(folder);
      }
    };
    watcher.onDidCreate(scheduleRefresh);
    watcher.onDidChange(scheduleRefresh);
    watcher.onDidDelete(scheduleRefresh);
    this.folderWatchers.set(folderKey, watcher);
  }

  private scheduleRefresh(folder: vscode.WorkspaceFolder) {
    const folderKey = folder.uri.toString();
    const previousTimer = this.refreshTimers.get(folderKey);
    if (previousTimer) {
      clearTimeout(previousTimer);
    }
    this.refreshTimers.set(
      folderKey,
      setTimeout(() => {
        this.refreshTimers.delete(folderKey);
        void this.refreshFolder(folder);
      }, 150)
    );
  }

  private removeFolder(folder: vscode.WorkspaceFolder) {
    const folderKey = folder.uri.toString();
    const previousProjects = this.getProjectsForFolder(folder);
    for (const project of previousProjects) {
      this.projects.delete(canonicalPath(project.projectFile.fsPath));
    }
    this.folderWatchers.get(folderKey)?.dispose();
    this.folderWatchers.delete(folderKey);
    const timer = this.refreshTimers.get(folderKey);
    if (timer) {
      clearTimeout(timer);
      this.refreshTimers.delete(folderKey);
    }
    if (previousProjects.length > 0) {
      this.projectsChanged.fire();
    }
  }

  dispose() {
    for (const watcher of this.folderWatchers.values()) {
      watcher.dispose();
    }
    for (const timer of this.refreshTimers.values()) {
      clearTimeout(timer);
    }
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.projectsChanged.dispose();
    this.folderWatchers.clear();
    this.refreshTimers.clear();
    this.projects.clear();
  }
}

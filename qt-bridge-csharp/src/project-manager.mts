// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import * as vscode from 'vscode';
import {
  createLogger,
  type QtBridgeMetadataChangeEvent,
  type QtBridgeProject
} from 'qt-lib';
import {
  discoverQtBridgeMetadata,
  getPersistedQtBridgeMetadataSelection,
  getQtBridgeMetadataIdentity,
  persistQtBridgeMetadataSelection
} from '@/metadata.mjs';
import { inspectQtBridgeProject, QtBridgeProjectSnapshot } from '@/project.mjs';
import { EXTENSION_ID } from '@/constants.js';

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

export class QtBridgeProjectManager implements vscode.Disposable {
  private workspaceState: vscode.Memento | undefined;
  private readonly projects = new Map<string, QtBridgeProjectSnapshot>();
  private readonly folderWatchers = new Map<string, vscode.FileSystemWatcher>();
  private readonly metadataWatchers = new Map<string, vscode.Disposable[]>();
  private readonly refreshTimers = new Map<string, NodeJS.Timeout>();
  private readonly metadataRefreshTimers = new Map<string, NodeJS.Timeout>();
  private readonly metadataRefreshVersions = new Map<string, number>();
  private readonly projectsChanged = new vscode.EventEmitter<void>();
  private readonly metadataChanged =
    new vscode.EventEmitter<QtBridgeMetadataChangeEvent>();
  private readonly disposables: vscode.Disposable[] = [];

  readonly onDidChangeProjects = this.projectsChanged.event;
  readonly onDidChangeMetadata = this.metadataChanged.event;

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

  async initialize(workspaceState?: vscode.Memento): Promise<void> {
    this.workspaceState = workspaceState;
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
    const mappedProjects = this.getProjects().filter(
      (project) =>
        project.isMetadataReady &&
        project.metadata?.qml.files.some(
          (file) => canonicalPath(file.sourcePath) === candidatePath
        )
    );
    if (mappedProjects.length === 1) {
      return mappedProjects[0];
    }
    if (mappedProjects.length > 1) {
      return undefined;
    }

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

  async selectMetadata(): Promise<void> {
    const projects = [...this.projects.values()].filter(
      (project) => project.metadataCandidates.length > 0
    );
    if (projects.length === 0) {
      void vscode.window.showInformationMessage(
        'No Qt Bridge build metadata is available.'
      );
      return;
    }

    const activeUri = vscode.window.activeTextEditor?.document.uri;
    const activeProject = activeUri
      ? this.getProjectForUri(activeUri)
      : undefined;
    let project = activeProject
      ? this.projects.get(canonicalPath(activeProject.projectFile.fsPath))
      : undefined;
    if (!project || project.metadataCandidates.length === 0) {
      if (projects.length === 1) {
        project = projects[0];
      } else {
        const selection = await vscode.window.showQuickPick(
          projects.map((candidate) => ({
            label: path.basename(candidate.projectFile.fsPath),
            description: vscode.workspace.asRelativePath(
              candidate.projectFile,
              false
            ),
            project: candidate
          })),
          {
            placeHolder: 'Select a Qt Bridge project',
            title: 'Select QML build metadata'
          }
        );
        project = selection?.project;
      }
    }
    if (!project) {
      return;
    }

    const selection = await vscode.window.showQuickPick(
      project.metadataCandidates.map((candidate) => ({
        label: candidate.configuration,
        description: candidate.targetFramework ?? 'No target framework',
        detail: vscode.workspace.asRelativePath(candidate.metadataFile, false),
        metadata: candidate
      })),
      {
        placeHolder: 'Select the active configuration and target framework',
        title: `Select QML build metadata for ${path.basename(
          project.projectFile.fsPath
        )}`
      }
    );
    if (!selection || !this.workspaceState) {
      return;
    }

    await persistQtBridgeMetadataSelection(
      this.workspaceState,
      getQtBridgeMetadataIdentity(selection.metadata)
    );
    await this.refreshMetadata(project, 'metadata');
  }

  async refreshFolder(
    folder: vscode.WorkspaceFolder,
    notify = true
  ): Promise<void> {
    const previousProjects = this.getProjectsForFolder(folder);
    const previousMetadataFiles = new Map(
      previousProjects.map((project) => [
        canonicalPath(project.projectFile.fsPath),
        project.metadata?.metadataFile
      ])
    );
    const projectFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(folder, '**/*.csproj'),
      PROJECT_EXCLUDE_PATTERN
    );
    const inspectedProjects = projectFiles.map((projectFile) =>
      inspectQtBridgeProject(projectFile)
    );

    for (const project of previousProjects) {
      const key = canonicalPath(project.projectFile.fsPath);
      this.projects.delete(key);
      this.disposeMetadataWatchers(key);
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
      const key = canonicalPath(projectFile.fsPath);
      this.projects.set(key, project);
      await this.refreshMetadata(
        project,
        'project',
        false,
        previousMetadataFiles.get(key)
      );
    }

    const currentProjects = this.getProjectsForFolder(folder);
    logger.info(
      `Qt Bridge discovery found ${String(currentProjects.length)} project(s) in ${folder.uri.fsPath}`
    );
    if (notify) {
      this.projectsChanged.fire();
    }
  }

  private async refreshMetadata(
    project: QtBridgeProjectSnapshot,
    reason: QtBridgeMetadataChangeEvent['reason'],
    notify = true,
    previousMetadataFile = project.metadata?.metadataFile
  ) {
    const key = canonicalPath(project.projectFile.fsPath);
    if (this.projects.get(key) !== project) {
      return;
    }
    const refreshVersion = (this.metadataRefreshVersions.get(key) ?? 0) + 1;
    this.metadataRefreshVersions.set(key, refreshVersion);
    const previous = project.metadata;
    const previousWasReady = project.isMetadataReady;
    const explicitSelection = getPersistedQtBridgeMetadataSelection(
      this.workspaceState,
      project.projectFile.fsPath
    );
    const result = await discoverQtBridgeMetadata(project.projectFile, {
      ...(explicitSelection ? { explicitSelection } : {}),
      ...(previousMetadataFile ? { previousMetadataFile } : {}),
      ...(previous && previousWasReady
        ? { previousReadyMetadata: previous }
        : {})
    });
    if (
      this.projects.get(key) !== project ||
      this.metadataRefreshVersions.get(key) !== refreshVersion
    ) {
      return;
    }
    project.updateMetadata(
      result.metadata,
      result.isReady,
      result.candidates
    );
    if (result.isAmbiguous) {
      logger.warn(
        `Multiple QML build metadata candidates are available for ${project.projectFile.fsPath}; ` +
          `run ${EXTENSION_ID}.selectQmlMetadata to select one`
      );
    }
    this.watchMetadata(project, result.readyFiles);
    if (notify && result.metadata !== previous) {
      this.metadataChanged.fire({
        project,
        previous,
        current: project.metadata,
        reason
      });
    }
  }

  private watchMetadata(
    project: QtBridgeProjectSnapshot,
    readyFiles: readonly string[]
  ) {
    const key = canonicalPath(project.projectFile.fsPath);
    this.disposeMetadataWatchers(key, false);
    const watchers: vscode.Disposable[] = [];
    const metadataWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(
        path.dirname(project.projectFile.fsPath),
        'obj/**/qtbridge-qml.ide.json'
      )
    );
    const metadataSignal = () => {
      this.scheduleMetadataRefresh(project, 'metadata');
    };
    watchers.push(
      metadataWatcher,
      metadataWatcher.onDidCreate(metadataSignal),
      metadataWatcher.onDidChange(metadataSignal),
      metadataWatcher.onDidDelete(metadataSignal)
    );
    for (const readyFile of new Set(readyFiles.map(canonicalPath))) {
      const readyWatcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(
          path.dirname(readyFile),
          path.basename(readyFile)
        )
      );
      const readySignal = () => {
        this.scheduleMetadataRefresh(project, 'ready-marker');
      };
      watchers.push(
        readyWatcher,
        readyWatcher.onDidCreate(readySignal),
        readyWatcher.onDidChange(readySignal),
        readyWatcher.onDidDelete(readySignal)
      );
    }
    this.metadataWatchers.set(key, watchers);
  }

  private scheduleMetadataRefresh(
    project: QtBridgeProjectSnapshot,
    reason: QtBridgeMetadataChangeEvent['reason']
  ) {
    const key = canonicalPath(project.projectFile.fsPath);
    const previousTimer = this.metadataRefreshTimers.get(key);
    if (previousTimer) {
      clearTimeout(previousTimer);
    }
    this.metadataRefreshTimers.set(
      key,
      setTimeout(() => {
        this.metadataRefreshTimers.delete(key);
        void this.refreshMetadata(project, reason);
      }, 150)
    );
  }

  private getProjectsForFolder(
    folder: vscode.WorkspaceFolder
  ): readonly QtBridgeProjectSnapshot[] {
    return [...this.projects.values()]
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

  private disposeMetadataWatchers(key: string, cancelRefresh = true) {
    for (const watcher of this.metadataWatchers.get(key) ?? []) {
      watcher.dispose();
    }
    this.metadataWatchers.delete(key);
    if (cancelRefresh) {
      const timer = this.metadataRefreshTimers.get(key);
      if (timer) {
        clearTimeout(timer);
        this.metadataRefreshTimers.delete(key);
      }
      this.metadataRefreshVersions.delete(key);
    }
  }

  private removeFolder(folder: vscode.WorkspaceFolder) {
    const folderKey = folder.uri.toString();
    const previousProjects = this.getProjectsForFolder(folder);
    for (const project of previousProjects) {
      const key = canonicalPath(project.projectFile.fsPath);
      this.projects.delete(key);
      this.disposeMetadataWatchers(key);
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
    for (const key of this.metadataWatchers.keys()) {
      this.disposeMetadataWatchers(key);
    }
    for (const timer of this.refreshTimers.values()) {
      clearTimeout(timer);
    }
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.projectsChanged.dispose();
    this.metadataChanged.dispose();
    this.folderWatchers.clear();
    this.refreshTimers.clear();
    this.projects.clear();
  }
}

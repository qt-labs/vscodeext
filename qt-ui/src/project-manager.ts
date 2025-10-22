// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import {
  QtWorkspaceConfigMessage,
  ProjectManager,
  createLogger,
  QtWorkspaceFeatures,
  CoreKey
} from 'qt-lib';
import * as consts from '@/constants';
import { coreAPI } from '@/extension';
import { createUIProject, UIProject } from '@/project';

const logger = createLogger('project-manager');

export class UIProjectManager extends ProjectManager<UIProject> {
  public constructor(context: vscode.ExtensionContext) {
    super(context, createUIProject);

    this._disposables.push(
      this.onProjectAdded(UIProjectManager._onProjectAdded),
      this.onProjectRemoved(UIProjectManager._onProjectRemoved),
      vscode.workspace.onDidChangeConfiguration(this._onWorkspaceConfigChanged)
    );
  }

  public async init() {
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
      const project = await createUIProject(folder, this.context);
      await project.init();
      this.addProject(project);
    }

    if (coreAPI) {
      this._disposables.push(
        coreAPI.onValueChanged(this._onCoreConfigMessasge)
      );
    }
  }

  private readonly _onCoreConfigMessasge = async (
    msg: QtWorkspaceConfigMessage
  ) => {
    logger.info('Received config message:', msg.config as unknown as string);

    if (typeof msg.workspaceFolder === 'string') {
      // do nothing if workspace folder is a string
      return;
    }

    const folder = msg.workspaceFolder;
    const project = this.getProject(folder);
    if (!project) {
      logger.error(`Project not found: folder = ${folder.uri.fsPath}`);
      return;
    }

    for (const key of msg.config.keys()) {
      if (key === CoreKey.SELECTED_KIT_PATH) {
        const value = coreAPI?.getValue<string>(folder, key);
        await project.setSelectedKitPath(value);
        continue;
      }

      if (key === CoreKey.SELECTED_QT_PATHS) {
        const value = coreAPI?.getValue<string>(folder, key);
        await project.setSelectedQtPaths(value);
        continue;
      }

      if (key === CoreKey.WORKSPACE_FEATURES) {
        await project.setWorkspaceFeatures(
          coreAPI?.getValue<QtWorkspaceFeatures>(folder, key)
        );
        continue;
      }

      if (key === CoreKey.VENV_BIN_PATH) {
        const value = coreAPI?.getValue<string>(folder, key);
        await project.setVenvBinPath(value);
      }
    }
  };

  private readonly _onWorkspaceConfigChanged = async (
    ev: vscode.ConfigurationChangeEvent
  ) => {
    const key = consts.CONF_CUSTOM_WIDGETS_DESIGNER_EXE_PATH;
    const section = `${consts.EXTENSION_ID}.${key}`;

    for (const project of this.getProjects()) {
      if (ev.affectsConfiguration(section, project.folder)) {
        await project.tryReloadCustomExePath();
      }
    }
  };

  private static readonly _onProjectAdded = async (project: UIProject) => {
    logger.info('Adding project:', project.folder.uri.fsPath);
    await project.init();
  };

  private static readonly _onProjectRemoved = (project: UIProject) => {
    logger.info('Project removed:', project.folder.uri.fsPath);
  };
}

// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as fs from 'fs';

import {
  Project,
  createLogger,
  resolveConfiguration,
  QtWorkspaceFeatures,
  CoreKey
} from 'qt-lib';
import * as consts from '@/constants';
import { coreAPI } from '@/extension';
import { DesignerClient } from '@/designer-client';
import { DesignerServer } from '@/designer-server';
import {
  locateDesignerFromKit,
  locateDesignerFromQtPaths,
  locateDesignerFromVenvBinPaths
} from '@/util';

type UpdateReason =
  | 'init'
  | 'customExeChanged'
  | 'workspaceFeatureChanged'
  | 'selectedKitPathChanged'
  | 'selectedQtPathsChanged'
  | 'venvBinPathChanged';

const logger = createLogger('project');

export async function createUIProject(
  folder: vscode.WorkspaceFolder,
  context: vscode.ExtensionContext
) {
  const project = new UIProject(folder, context);
  return Promise.resolve(project);
}

// Project class represents a workspace folder in the extension.
export class UIProject implements Project {
  private _customExePath: string | undefined;
  private _workspaceFeatures: QtWorkspaceFeatures | undefined;
  private _selectedKitPath: string | undefined;
  private _selectedQtPaths: string | undefined;
  private _venvBinPath: string | undefined;

  private _designerClient: DesignerClient | undefined;
  private readonly _designerServer: DesignerServer;

  public constructor(
    readonly _folder: vscode.WorkspaceFolder,
    readonly _context: vscode.ExtensionContext
  ) {
    this._designerServer = new DesignerServer();
  }

  dispose() {
    this._designerServer.dispose();
    this._designerClient?.dispose();
  }

  get folder() {
    return this._folder;
  }

  get designerServer() {
    return this._designerServer;
  }

  get designerClient() {
    return this._designerClient;
  }

  get workspaceFeatures() {
    return this._workspaceFeatures;
  }

  public async init() {
    const read = coreAPI?.getValue.bind(coreAPI);
    if (!read) {
      return;
    }

    this._customExePath = this._readCustomExePath();
    this._workspaceFeatures = read<QtWorkspaceFeatures>(
      this._folder,
      CoreKey.WORKSPACE_FEATURES
    );
    this._selectedKitPath = read<string>(
      this._folder,
      CoreKey.SELECTED_KIT_PATH
    );
    this._selectedQtPaths = read<string>(
      this._folder,
      CoreKey.SELECTED_QT_PATHS
    );
    this._venvBinPath = read<string>(this._folder, CoreKey.VENV_BIN_PATH);

    await this._updateClient('init');
  }

  public async tryReloadCustomExePath() {
    const exe = this._readCustomExePath();

    if (this._customExePath !== exe) {
      this._customExePath = exe;
      await this._updateClient('customExeChanged');
    }
  }

  public async setWorkspaceFeatures(features: QtWorkspaceFeatures | undefined) {
    if (this._workspaceFeatures !== features) {
      this._workspaceFeatures = features;
      await this._updateClient('workspaceFeatureChanged');
    }
  }

  public async setSelectedKitPath(selectedKitPath: string | undefined) {
    if (this._selectedKitPath !== selectedKitPath) {
      this._selectedKitPath = selectedKitPath;
      await this._updateClient('selectedKitPathChanged');
    }
  }

  public async setSelectedQtPaths(exePath: string | undefined) {
    if (this._selectedQtPaths !== exePath) {
      this._selectedQtPaths = exePath;
      await this._updateClient('selectedQtPathsChanged');
    }
  }

  public async setVenvBinPath(venvBinPath: string | undefined) {
    if (this._venvBinPath !== venvBinPath) {
      this._venvBinPath = venvBinPath;
      await this._updateClient('venvBinPathChanged');
    }
  }

  private async _updateClient(reason: UpdateReason) {
    const exe = await this._resolveDesignerExe();
    if (!exe) {
      this._clearClient();
      return;
    }

    const prev = this._designerClient?.exe;
    if (!prev && prev === exe) {
      return;
    }

    this._clearClient();
    this._designerClient = new DesignerClient(
      exe,
      this._designerServer.getPort()
    );

    // clean up
    if (reason === 'selectedKitPathChanged') {
      this._selectedQtPaths = undefined;
    } else if (reason === 'selectedQtPathsChanged') {
      this._selectedKitPath = undefined;
    }
  }

  private _clearClient() {
    this._designerClient?.detach();
    this._designerClient?.dispose();
    this._designerClient = undefined;
  }

  private async _resolveDesignerExe() {
    if (this._customExePath) {
      if (fs.existsSync(this._customExePath)) {
        return this._customExePath;
      }

      const msg =
        'Qt Widgets Designer executable not found at: ' +
        `"${this._customExePath}"`;

      logger.error(msg);
      void vscode.window.showWarningMessage(msg);
    }

    if (this._workspaceFeatures?.projectTypes.pyside) {
      if (this._venvBinPath) {
        return locateDesignerFromVenvBinPaths(this._venvBinPath);
      }
    }

    if (this._workspaceFeatures?.projectTypes.cmake) {
      if (this._selectedKitPath) {
        return locateDesignerFromKit(this._selectedKitPath);
      }

      if (this._selectedQtPaths) {
        return locateDesignerFromQtPaths(this._selectedQtPaths);
      }
    }

    return undefined;
  }

  private _readCustomExePath() {
    const folder = this.folder;
    const config = vscode.workspace
      .getConfiguration(consts.EXTENSION_ID, folder)
      .get<string>(consts.CONF_CUSTOM_WIDGETS_DESIGNER_EXE_PATH, '');
    const value = resolveConfiguration(config);

    logger.info(
      'Read custom desinger exe path: ',
      `value = ${value}, `,
      `folder = '${folder.uri.fsPath}'`
    );

    return value;
  }
}

// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as fs from 'fs';

import { DesignerClient } from '@/designer-client';
import { DesignerServer } from '@/designer-server';
import {
  createLogger,
  QtWorkspaceType,
  Project,
  resolveConfiguration
} from 'qt-lib';
import {
  getConfig,
  affectsConfig,
  locateDesignerFromKit,
  locateDesignerFromQtPaths
} from '@/util';
import { CONF_CUSTOM_WIDGETS_DESIGNER_EXE_PATH } from '@/constants';
import { coreAPI } from '@/extension';

const logger = createLogger('project');

export async function createUIProject(
  folder: vscode.WorkspaceFolder,
  context: vscode.ExtensionContext
) {
  return Promise.resolve(new UIProject(folder, context));
}

// Project class represents a workspace folder in the extension.
export class UIProject implements Project {
  private readonly _disposables: vscode.Disposable[] = [];
  private _workspaceType: QtWorkspaceType | undefined;
  private _selectedKitPath: string | undefined;
  private _designerClient: DesignerClient | undefined;
  private _qtpathsExe: string | undefined;
  private readonly _designerServer: DesignerServer;
  private _customWidgetsDesignerExePath: string | undefined;
  public constructor(
    readonly _folder: vscode.WorkspaceFolder,
    readonly _context: vscode.ExtensionContext
  ) {
    this._designerServer = new DesignerServer();
    this._customWidgetsDesignerExePath = this.getQtCustomDesignerPath();
    logger.info(
      `${CONF_CUSTOM_WIDGETS_DESIGNER_EXE_PATH}: "${this._customWidgetsDesignerExePath}"`
    );
    if (this._customWidgetsDesignerExePath) {
      if (
        UIProject.checkCustomDesignerExePath(this._customWidgetsDesignerExePath)
      ) {
        this.designerClient = new DesignerClient(
          this._customWidgetsDesignerExePath,
          this._designerServer.getPort()
        );
      }
    }
    const eventHandler = vscode.workspace.onDidChangeConfiguration(
      async (event) => {
        if (
          affectsConfig(
            event,
            CONF_CUSTOM_WIDGETS_DESIGNER_EXE_PATH,
            this._folder
          )
        ) {
          this._customWidgetsDesignerExePath = this.getQtCustomDesignerPath();
          logger.info(
            `new ${CONF_CUSTOM_WIDGETS_DESIGNER_EXE_PATH}:`,
            this._customWidgetsDesignerExePath
          );
          if (
            this._customWidgetsDesignerExePath &&
            UIProject.checkCustomDesignerExePath(
              this._customWidgetsDesignerExePath
            )
          ) {
            this.designerClient = new DesignerClient(
              this._customWidgetsDesignerExePath,
              this._designerServer.getPort()
            );
          } else {
            // That means the user has removed the path.
            // So, we need to detach the client and get the designer from qtpaths
            // or from the selected kit.
            let isDesignerClientSet = false;
            if (this._designerClient) {
              if (this._selectedKitPath) {
                this.designerClient = await this.getNewDesignerClient(
                  this._selectedKitPath
                );
                isDesignerClientSet = true;
              } else if (this._qtpathsExe) {
                const designer = await locateDesignerFromQtPaths(
                  this._qtpathsExe
                );
                if (designer) {
                  this.designerClient = new DesignerClient(
                    designer,
                    this.designerServer.getPort()
                  );
                  isDesignerClientSet = true;
                }
              }
            }
            if (!isDesignerClientSet) {
              this.designerClient = undefined;
            }
          }
        }
      }
    );
    this._disposables.push(eventHandler);
  }
  getQtCustomDesignerPath() {
    return resolveConfiguration(
      getConfig<string>(CONF_CUSTOM_WIDGETS_DESIGNER_EXE_PATH, '', this._folder)
    );
  }

  private async getNewDesignerClient(selectedKitPath: string) {
    const designerExe = await locateDesignerFromKit(selectedKitPath);
    if (!designerExe) {
      return undefined;
    }
    const designerClient = new DesignerClient(
      designerExe,
      this.designerServer.getPort()
    );
    return designerClient;
  }
  get workspaceType() {
    return this._workspaceType;
  }
  set workspaceType(workspaceType: QtWorkspaceType | undefined) {
    this._workspaceType = workspaceType;
  }

  get selectedKitPath() {
    return this._selectedKitPath;
  }

  get qtpathsExe() {
    return this._qtpathsExe;
  }

  async setQtPathsExe(qtpathsExe: string | undefined) {
    if (qtpathsExe === this._qtpathsExe) {
      return;
    }
    this._qtpathsExe = qtpathsExe;
    if (this._customWidgetsDesignerExePath) {
      return;
    }
    if (qtpathsExe === undefined) {
      this.designerClient = undefined;
      return;
    } else {
      this._selectedKitPath = undefined; // Reset selectedKitPath when qtpathsExe is set
    }

    const designer = await locateDesignerFromQtPaths(qtpathsExe);
    if (designer) {
      this.designerClient = new DesignerClient(
        designer,
        this.designerServer.getPort()
      );
    } else {
      this.designerClient = undefined;
    }
  }

  async setSelectedKitPath(selectedKitPath: string | undefined) {
    if (selectedKitPath === this._selectedKitPath) {
      return;
    }

    this._selectedKitPath = selectedKitPath;
    if (this._customWidgetsDesignerExePath) {
      return;
    }
    if (selectedKitPath === undefined) {
      this.designerClient = undefined;
      return;
    } else {
      this._qtpathsExe = undefined; // Reset qtpathsExe when a kit is selected
    }
    this.designerClient = await this.getNewDesignerClient(selectedKitPath);
  }

  get designerServer() {
    return this._designerServer;
  }
  get designerClient() {
    return this._designerClient;
  }
  set designerClient(client: DesignerClient | undefined) {
    this._designerClient?.detach();
    this._designerClient = client;
  }
  get folder() {
    return this._folder;
  }
  public async getConfigValues() {
    await this.tryToGetDesigner();
    this.workspaceType = coreAPI?.getValue<QtWorkspaceType>(
      this.folder,
      'workspaceType'
    );
  }
  public async tryToGetDesigner() {
    const selectedKitPath = coreAPI?.getValue<string>(
      this.folder,
      'selectedKitPath'
    );
    const selectedQtPaths = coreAPI?.getValue<string>(
      this.folder,
      'selectedQtPaths'
    );

    if (selectedKitPath) {
      await this.setSelectedKitPath(selectedKitPath);
    } else if (selectedQtPaths) {
      await this.setQtPathsExe(selectedQtPaths);
    } else {
      this.designerClient = undefined;
      logger.warn(
        'No Qt Widgets Designer found for project:',
        this.folder.uri.fsPath
      );
    }
  }

  private static checkCustomDesignerExePath(
    customWidgetsDesignerExePath: string
  ) {
    if (!fs.existsSync(customWidgetsDesignerExePath)) {
      logger.error(
        'Qt Widgets Designer executable not found at:"',
        customWidgetsDesignerExePath,
        '"'
      );
      void vscode.window.showWarningMessage(
        'Qt Widgets Designer executable not found at:"' +
          customWidgetsDesignerExePath +
          '"'
      );
      return false;
    }
    return true;
  }
  dispose() {
    this._designerServer.dispose();
    this._designerClient?.dispose();
    for (const d of this._disposables) {
      d.dispose();
    }
  }
}

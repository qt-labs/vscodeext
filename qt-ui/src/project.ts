// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as fs from 'fs';
import untildify from 'untildify';

import { DesignerClient } from '@/designer-client';
import { DesignerServer } from '@/designer-server';
import { createLogger, QtWorkspaceType, Project } from 'qt-lib';
import { getConfig, affectsConfig, locateQtDesignerExePath } from '@/util';
import { CONF_CUSTOM_WIDGETS_DESIGNER_EXE_PATH } from '@/constants';

const logger = createLogger('project');

export async function createUIProject(
  folder: vscode.WorkspaceFolder,
  context: vscode.ExtensionContext
) {
  return Promise.resolve(new UIProject(folder, context));
}

// Project class represents a workspace folder in the extension.
export class UIProject implements Project {
  private _workspaceType: QtWorkspaceType | undefined;
  private _binDir: string | undefined;
  private _designerClient: DesignerClient | undefined;
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
        this._designerClient = new DesignerClient(
          this._customWidgetsDesignerExePath,
          this._designerServer.getPort()
        );
      }
    }
    vscode.workspace.onDidChangeConfiguration((event) => {
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
          this._designerClient?.detach();
          this._designerClient = new DesignerClient(
            this._customWidgetsDesignerExePath,
            this._designerServer.getPort()
          );
        } else {
          // That means the user has removed the path.
          // So, we need to detach the client.
          if (this._designerClient) {
            this._designerClient.detach();
            this._designerClient = new DesignerClient(
              this.getQtCustomDesignerPath(),
              this._designerServer.getPort()
            );
          }
        }
      }
    });
  }
  getQtCustomDesignerPath() {
    return untildify(
      getConfig<string>(CONF_CUSTOM_WIDGETS_DESIGNER_EXE_PATH, '', this._folder)
    );
  }

  private async getNewDesignerClient(binDir: string) {
    const designerClient = new DesignerClient(
      await locateQtDesignerExePath(binDir),
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

  get binDir() {
    return this._binDir;
  }
  async setBinDir(binDir: string | undefined) {
    if (binDir !== this._binDir && binDir !== undefined) {
      if (!this._customWidgetsDesignerExePath) {
        this._binDir = binDir;
        this._designerClient?.detach();
        if (this.binDir) {
          this._designerClient = await this.getNewDesignerClient(binDir);
        } else {
          this._designerClient = undefined;
        }
      }
    }
  }
  get designerServer() {
    return this._designerServer;
  }
  get designerClient() {
    return this._designerClient;
  }
  set designerClient(client: DesignerClient | undefined) {
    this._designerClient = client;
  }
  get folder() {
    return this._folder;
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
  }
}

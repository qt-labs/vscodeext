// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { createWrappedLogger, QtWorkspaceConfigMessage } from 'qt-lib';
import { CoreProject } from '@/project';
import { projectManager, coreAPI } from '@/extension';
import { UiDesignerRunner } from './runner';
import { UiDesignerLocator } from './locator';
import { UiDesignerTcpServer } from './tcp-server';
import * as consts from './constants';

const logger = createWrappedLogger('ui-designer-session');

export class UiDesignerSession {
  private readonly _server: UiDesignerTcpServer;
  private readonly _runner: UiDesignerRunner;
  private readonly _locator: UiDesignerLocator;
  private readonly _disposables: vscode.Disposable[] = [];

  constructor(private readonly _project: CoreProject) {
    logger.text('Creating session').data('name', this.name).info();

    this._server = new UiDesignerTcpServer(this._project.folder.name);
    this._runner = new UiDesignerRunner(this._server);
    this._locator = new UiDesignerLocator(this._project.folder);

    this._disposables.push(
      this._runner,
      this._server,
      vscode.workspace.onDidChangeConfiguration(
        this._onWorkspaceConfigChanged.bind(this)
      )
    );
  }

  public init() {
    if (coreAPI) {
      this._disposables.push(
        coreAPI.onValueChanged(this._onQtCoreMessage.bind(this))
      );
    }
  }

  public dispose() {
    this._disposables.forEach((e) => {
      e.dispose();
    });
  }

  public get name() {
    return this._project.folder.name;
  }

  public get configs() {
    return this._locator.configs;
  }

  public async open(uri: vscode.Uri) {
    this._server.ensureListening();
    await this._runner.openFile(uri, this._locator);
  }

  // private
  private async _onChanged(reason: 'custom-exe' | 'qt-core') {
    logger
      .text('Config changed')
      .data('name', this.name)
      .data('reason', reason)
      .info();

    const oldExePath = this._runner.exePath;
    const newExePath = await this._locator.locate();
    if (oldExePath !== newExePath?.filePath) {
      logger
        .text('Exe path changed')
        .data('name', this.name)
        .data('old', oldExePath ?? '<none>')
        .data('new', newExePath?.filePath ?? '<none>')
        .info({ multipleLine: true });
    }

    console.log(this.configs);
  }

  private async _onWorkspaceConfigChanged(e: vscode.ConfigurationChangeEvent) {
    const name = [
      consts.CONF_SECTION,
      consts.CONF_CUSTOM_WIDGETS_DESIGNER_EXE_PATH
    ].join('.');

    if (e.affectsConfiguration(name, this._project.folder)) {
      await this._onChanged('custom-exe');
    }
  }

  private async _onQtCoreMessage(message: QtWorkspaceConfigMessage) {
    if (this._project.folder === message.workspaceFolder) {
      if (this._locator.isAffectedBy(message)) {
        await this._onChanged('qt-core');
      }
    }
  }
}

export function findUiDesignerSession(docUri: vscode.Uri) {
  const project = projectManager.findProjectContainingFile(docUri);
  if (!project) {
    logger
      .text('Cannot find a project for the document')
      .data('doc', docUri.fsPath)
      .error();
  }

  return project?.getUiDesignerSession();
}

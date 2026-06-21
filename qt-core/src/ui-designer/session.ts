// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { createWrappedLogger } from 'qt-lib';
import { CoreProject } from '@/project';
import { projectManager } from '@/extension';
import { UiDesignerRunner } from './runner';
import { UiDesignerLocator } from './locator';
import { UiDesignerTcpServer } from './tcp-server';

const logger = createWrappedLogger('ui-designer-session');

export class UiDesignerSession {
  private readonly _locator: UiDesignerLocator;
  private readonly _runner: UiDesignerRunner;
  private readonly _server: UiDesignerTcpServer;
  private readonly _disposables: vscode.Disposable[] = [];

  constructor(private readonly _project: CoreProject) {
    logger
      .text('Creating session')
      .data('folder', this._project.folder.name)
      .info();

    this._locator = new UiDesignerLocator(this._project.folder);
    this._runner = new UiDesignerRunner(this._locator);
    this._server = new UiDesignerTcpServer(this._project.folder.name);

    this._disposables.push(this._runner, this._server);
  }

  public dispose() {
    logger
      .text('Disposing session')
      .data('folder', this._project.folder.name)
      .info();

    this._disposables.forEach((e) => {
      e.dispose();
    });
  }

  public async open(uri: vscode.Uri) {
    const port = this._server.ensureListening();
    if (!port) {
      const msg = 'TCP port is not set';
      logger.text(msg).error();
      throw Error(msg);
    }

    await this._runner.ensureRunning(port);
    while (!this._server.hasConnection()) {
      await sleep(100);
    }

    this._server.writeToClient(uri.fsPath, { addNewLine: true });
  }
}

export function findUiDesignerSession(docUri: vscode.Uri) {
  const project = projectManager.findProjectContainingFile(docUri);
  if (!project) {
    logger
      .text(
        [
          'Cannot find a project for the document.',
          'Make sure the document is part of a workspace folder.'
        ].join(' ')
      )
      .data('file', docUri.fsPath)
      .error({ showMessage: true });
  }

  return project?.getUiDesignerSession();
}

// helper
async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

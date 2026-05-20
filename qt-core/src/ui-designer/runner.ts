// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as cp from 'child_process';
import * as vscode from 'vscode';

import { createWrappedLogger } from 'qt-lib';
import { UiDesignerLocator } from './locator';
import { UiDesignerTcpServer } from './tcp-server';

const logger = createWrappedLogger('ui-designer-runner');

export class UiDesignerRunner {
  private _proc: ReturnType<typeof cp.spawn> | undefined;

  constructor(private readonly _server: UiDesignerTcpServer) {}

  public dispose() {
    this._ensureDesignerProcCleared();
  }

  public async openFile(uri: vscode.Uri, locator: UiDesignerLocator) {
    if (this._proc === undefined) {
      await this._launchDesigner(locator);
    }

    this._server.writeToClient(uri.fsPath, { addNewLine: true });
  }

  public get exePath() {
    return this._proc?.spawnfile;
  }

  // private
  private _ensureDesignerProcCleared() {
    if (!this._proc) {
      return;
    }

    logger
      .text('Stopping designer process')
      .data('pid', this._proc.pid?.toString() ?? '<none>')
      .info();

    this._proc.unref();
    this._proc.kill();
    this._proc = undefined;
  }

  private async _launchDesigner(locator: UiDesignerLocator) {
    const tcpPort = this._server.port;
    if (!tcpPort) {
      logger.text('TCP port is not set').error({ throwError: true });
      return;
    }

    const exeInfo = await locator.selectExe();
    if (!exeInfo) {
      logger.text('Executable information is invalid').error();
      return;
    }

    logger
      .text('Launching Qt Widgets Designer')
      .data('source', exeInfo.source)
      .data('path', exeInfo.filePath)
      .info();

    const args = ['--client ' + tcpPort.toString()];
    this._proc = cp
      .spawn(exeInfo.filePath, args, { shell: true })
      .on('exit', (code) => {
        this._ensureDesignerProcCleared();
        logger
          .text('Designer exited with code')
          .data('code', code?.toString() ?? '')
          .info();
      })
      .on('error', () => {
        this._ensureDesignerProcCleared();
        logger
          .text('Failed to start designer process')
          .data('exe', exeInfo.filePath)
          .data('port', tcpPort.toString())
          .error({ throwError: true });
      });

    while (!this._server.hasConnection()) {
      await sleep(100);
    }
  }
}

// helper
async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

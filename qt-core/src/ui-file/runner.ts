// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as cp from 'child_process';

import { createWrappedLogger } from 'qt-lib';
import { UiDesignerLocator } from './locator';

const logger = createWrappedLogger('ui-designer-runner');

export class UiDesignerRunner {
  private _proc: ReturnType<typeof cp.spawn> | undefined;

  constructor(private readonly _locator: UiDesignerLocator) {
    logger.setOutputOptions({ multipleLine: true });
  }

  public dispose() {
    this._killProcess();
  }

  public async ensureRunning(port: number) {
    if (this._proc === undefined) {
      this._proc = await this._createProcess(port);
    }
  }

  // private
  private async _createProcess(tcpPort: number) {
    const designer = await this._locator.select();
    if (!designer) {
      return;
    }

    const logData = {
      path: designer.filePath,
      origin: designer.origin,
      port: tcpPort
    };

    logger.text('Launching Qt Widgets Designer').data(logData).info();

    const args = ['--client ' + tcpPort.toString()];
    const proc = cp
      .spawn(designer.filePath, args, { shell: true })
      .on('exit', this._onExit(logData))
      .on('error', this._onError(logData));

    return proc;
  }

  private _killProcess() {
    if (!this._proc) {
      return;
    }

    // TODO: what happens if there are unsaved changes
    logger
      .text('Stopping designer process')
      .data({
        pid: this._proc.pid,
        args: this._proc.spawnargs
      })
      .info();

    this._proc.unref();
    this._proc.kill();
    this._proc = undefined;
  }

  private _onExit(logData: object) {
    return (code: number | null) => {
      this._killProcess();
      logger
        .text('Designer exited')
        .data({ ...logData, pid: this._proc?.pid, exitCode: code })
        .info();
    };
  }

  private _onError(logData: object) {
    return (e: Error) => {
      this._killProcess();
      const msg = 'Failed to start designer process';
      logger
        .text(msg)
        .data({ ...logData, pid: this._proc?.pid, error: e })
        .error();
      throw Error(msg);
    };
  }
}

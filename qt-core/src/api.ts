// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import { spawnSync } from 'child_process';

import {
  CoreAPI,
  createLogger,
  QtWorkspaceConfig,
  QtWorkspaceConfigMessage,
  QtInfo
} from 'qt-lib';

const logger = createLogger('api');

export class CoreAPIImpl implements CoreAPI {
  private readonly _configs = new Map<
    vscode.WorkspaceFolder | string,
    QtWorkspaceConfig
  >();
  private readonly _onValueChanged =
    new vscode.EventEmitter<QtWorkspaceConfigMessage>();
  private readonly _qtInfoCache = new Map<string, QtInfo>();

  public get onValueChanged() {
    return this._onValueChanged.event;
  }

  private processMessage(message: QtWorkspaceConfigMessage) {
    let changed = false;
    for (const [key, value] of message.config) {
      if (value !== this._configs.get(message.workspaceFolder)?.get(key)) {
        logger.info('Config changed:', key);
        const config = this._configs.get(message.workspaceFolder);
        if (config) {
          config.set(key, value);
        } else {
          logger.info('New config: ' + JSON.stringify(value));
          const newConfig: QtWorkspaceConfig = new Map();
          newConfig.set(key, value);
          this._configs.set(message.workspaceFolder, newConfig);
        }
        changed = true;
      }
    }
    if (changed) {
      this._onValueChanged.fire(message);
    }
  }

  update(message: QtWorkspaceConfigMessage) {
    this.processMessage(message);
  }

  getValue<T>(
    folder: vscode.WorkspaceFolder | string,
    key: string
  ): T | undefined {
    return this._configs.get(folder)?.get(key) as T;
  }

  reset() {
    this._qtInfoCache.clear();
  }

  getQtInfo(qtPathsExecutable: string): QtInfo | undefined {
    let result = this._qtInfoCache.get(qtPathsExecutable);
    if (result) return result;

    result = new QtInfo(qtPathsExecutable);

    const ret = spawnSync(qtPathsExecutable, ['-query'], {
      encoding: 'utf8',
      timeout: 1000
    });
    if (ret.error ?? ret.status !== 0) {
      return undefined;
    }
    const output = ret.stdout;
    const lines = output.split('\n');
    for (const line of lines) {
      // split the line by the first `:`
      const [key, ...tempValue] = line.split(':');
      const value = tempValue.join(':');
      if (key) {
        result.set(key.trim(), value.trim());
      }
    }

    this._qtInfoCache.set(qtPathsExecutable, result);
    return result;
  }
}

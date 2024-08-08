// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import {
  CoreApi,
  createLogger,
  QtWorkspaceConfig,
  QtWorkspaceConfigMessage
} from 'qt-lib';

const logger = createLogger('api');

export class CoreApiImpl implements CoreApi {
  private readonly _configs = new Map<
    vscode.WorkspaceFolder | string,
    QtWorkspaceConfig
  >();
  private readonly _onValueChanged =
    new vscode.EventEmitter<QtWorkspaceConfigMessage>();

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
          logger.info('New config:', value ?? '');
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
}

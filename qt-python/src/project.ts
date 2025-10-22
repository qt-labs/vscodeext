// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { Project, createLogger } from 'qt-lib';
import { PySideEnv } from './env';
import { PySideProjectInfo } from './types';

type Folder = vscode.WorkspaceFolder;
type Context = vscode.ExtensionContext;

const logger = createLogger('project');

export class PySideProject implements Project {
  private _env: PySideEnv | undefined;
  private _info: PySideProjectInfo | undefined;

  private constructor(private readonly _folder: Folder) {
    logger.info(`Create: "${_folder.uri.fsPath}"`);
  }

  dispose() {
    logger.info(`Dispose: "${this._folder.uri.fsPath}"`);
  }

  get env() {
    return this._env;
  }

  set env(env: PySideEnv | undefined) {
    this._env = env;
  }

  set info(info: PySideProjectInfo | undefined) {
    this._info = info;
  }

  get folder() {
    return this._folder;
  }

  public isValid() {
    return this._info !== undefined;
  }

  public static create = async (folder: Folder, context: Context) => {
    void context;
    return Promise.resolve(new PySideProject(folder));
  };
}

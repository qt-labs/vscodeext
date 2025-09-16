// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import _ from 'lodash';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { parse } from 'smol-toml';
import { PythonExtension as PyApi } from '@vscode/python-extension';

import { Project, createLogger } from 'qt-lib';
import { PySideEnv } from './env';
import { PySideProjectInfo } from './types';
import { coreApi } from './extension';

import * as consts from './constants';

type Folder = vscode.WorkspaceFolder;
type Context = vscode.ExtensionContext;
const logger = createLogger('project');

export class PySideProject implements Project {
  private _env: PySideEnv | undefined;
  private _info: PySideProjectInfo | undefined;

  private constructor(private readonly _folder: Folder) {
    logger.info(`Create: "${_folder.uri.fsPath}"`);
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  dispose() {
    logger.info(`Dispose: "${this._folder.uri.fsPath}"`);
  }

  get env() {
    return this._env;
  }

  get folder() {
    return this._folder;
  }

  public isValid() {
    return this._info !== undefined;
  }

  public async refreshEnv(pyapi: PyApi | undefined) {
    this._env = await resolveEnv(pyapi, this._folder);
    const venvBinPath = this._env?.venvBinPath;

    if (venvBinPath) {
      coreApi?.setValue(this._folder, 'pythonVenvBinPath', venvBinPath);
    }
  }

  public refreshInfo() {
    const toml = path.join(
      this._folder.uri.fsPath,
      consts.TOML_PROJECT_FILE_NAME
    );

    this._info = parseToml(toml);
  }

  public static create = async (folder: Folder, context: Context) => {
    void context;
    return Promise.resolve(new PySideProject(folder));
  };
}

// helpers
async function resolveEnv(pyapi: PyApi | undefined, folder: Folder) {
  if (!pyapi) {
    logger.error('Python API is invalid');
    return undefined;
  }

  const envs = pyapi.environments;
  const envPath = envs.getActiveEnvironmentPath(folder);
  const resolved = await envs.resolveEnvironment(envPath);
  return resolved ? new PySideEnv(resolved) : undefined;
}

function parseToml(absPath: string): PySideProjectInfo | undefined {
  try {
    const data = fs.readFileSync(absPath, 'utf-8');
    const dataJson = parse(data);

    return {
      name: _.get(dataJson, consts.TOML_KEY_PROJECT_NAME, '') as string,
      files: _.get(dataJson, consts.TOML_KEY_PROJECT_FILES, []) as string[]
    };
  } catch (e) {
    return undefined;
  }
}

// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import _ from 'lodash';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { parse } from 'smol-toml';
import { PythonExtension as PyApi } from '@vscode/python-extension';

import {
  ConfigType,
  QtWorkspaceFeatures,
  QtWorkspaceConfigMessage,
  ProjectManager,
  createLogger,
  CoreKey
} from 'qt-lib';
import { PySideEnv } from './env';
import { PySideProject } from './project';
import { PySideProjectInfo } from './types';
import { pyApi, coreApi } from './extension';
import * as consts from '@/constants';

type Folder = vscode.WorkspaceFolder;
type Context = vscode.ExtensionContext;

const logger = createLogger('project-manager');

export class PySideProjectManager extends ProjectManager<PySideProject> {
  constructor(override readonly context: Context) {
    super(context, PySideProject.create);
    this._disposables.push(this.onProjectAdded(this._onProjectAdded));
  }

  public async init() {
    const folders = vscode.workspace.workspaceFolders ?? [];

    for (const folder of folders) {
      const p = await PySideProject.create(folder, this.context);
      this.addProject(p);
      await this._onProjectAdded(p);
    }
  }

  public async refreshEnv(folder: Folder) {
    const project = this.getProject(folder);
    if (!project) {
      return;
    }

    project.env = await resolveEnv(pyApi, folder);
    setCoreAndNotify(folder, CoreKey.VENV_BIN_PATH, project.env?.venvBinPath);
  }

  private _refreshProjectInfo(folder: Folder) {
    const project = this.getProject(folder);
    if (!project) {
      return;
    }

    project.info = parseToml(
      path.join(folder.uri.fsPath, consts.TOML_PROJECT_FILE_NAME)
    );

    const key = CoreKey.WORKSPACE_FEATURES;
    let value = coreApi?.getValue<QtWorkspaceFeatures>(folder, key);
    value ??= { projectTypes: {} };
    value.projectTypes.pyside = project.isValid();

    setCoreAndNotify(folder, key, value);
  }

  private readonly _onProjectAdded = async (p: PySideProject) => {
    await this.refreshEnv(p.folder);
    this._refreshProjectInfo(p.folder);
  };
}

// helpers
function setCoreAndNotify(folder: Folder, key: string, value: ConfigType) {
  if (!coreApi) {
    logger.error('CoreAPI is not initialized');
    return;
  }

  logger.info(
    `Updating core (${folder.name}): '${key}' = ${JSON.stringify(value)}`
  );

  const msg = new QtWorkspaceConfigMessage(folder);
  msg.config.add(key);

  coreApi.setValue(folder, key, value);
  coreApi.notify(msg);
}

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

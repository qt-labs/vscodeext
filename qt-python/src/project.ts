// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import _ from 'lodash';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import * as vscode from 'vscode';
import { parse } from 'smol-toml';

import {
  Project,
  createLogger,
  ConfigType,
  QtWorkspaceConfigMessage,
  CoreKey,
  QtWorkspaceFeatures
} from 'qt-lib';
import { PySideEnv } from './env';
import { PySideProjectInfo } from './types';
import { pyApi, coreApi } from './extension';
import * as texts from '@/texts';
import * as consts from '@/constants';

type Folder = vscode.WorkspaceFolder;
type Context = vscode.ExtensionContext;

const logger = createLogger('project');

export class PySideProject implements Project {
  private readonly _env: PySideEnv;
  private _info: PySideProjectInfo | undefined;

  private constructor(private readonly _folder: Folder) {
    logger.info(`Create: "${_folder.uri.fsPath}"`);
    this._env = new PySideEnv(_folder);
  }

  dispose() {
    logger.info(`Dispose: "${this._folder.uri.fsPath}"`);
    this._env.dispose();
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

  public async refreshEnv() {
    if (!pyApi) {
      return;
    }

    await this._env.refresh(pyApi);

    const pyside = await this._env.readPySide6PackageInfo();
    const qmlImportPath = pyside?.location
      ? path.normalize(path.join(pyside.location, consts.QML_IMPORT_SUBDIR))
      : '';

    this._setCoreAndNotify(CoreKey.PYSIDE_ENV_DATA, {
      venvBinPath: this._env.venvBinPath,
      qmlImportPath
    });

    void vscode.commands.executeCommand(consts.COMMAND_RESTART_QMLLS);
  }

  public async refreshInfo() {
    this._info = parseToml(
      path.join(this._folder.uri.fsPath, consts.TOML_PROJECT_FILE_NAME)
    );

    if (!this._info && !getDoNotWarnOldStyleProjects()) {
      await checkOldStyleProject(this._folder);
    }

    const key = CoreKey.WORKSPACE_FEATURES;
    let value = coreApi?.getValue<QtWorkspaceFeatures>(this._folder, key);
    value ??= { projectTypes: {} };
    value.projectTypes.pyside = this.isValid();

    this._setCoreAndNotify(key, value);
  }

  public static create = async (folder: Folder, context: Context) => {
    void context;
    return Promise.resolve(new PySideProject(folder));
  };

  private _setCoreAndNotify(key: string, value: ConfigType) {
    const folder = this._folder;
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
}

// helpers
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

async function checkOldStyleProject(folder: Folder) {
  const files = await glob.glob('*.pyproject', { cwd: folder.uri.fsPath });
  if (files.length == 0) {
    return;
  }

  const msg = texts.others.oldStyleProject.warn(folder.name);
  const btnDoc = texts.others.oldStyleProject.buttonOpenDoc;
  const btnOpt = texts.others.oldStyleProject.buttonDoNotShowAgain;

  logger.warn(msg);

  void vscode.window.showWarningMessage(msg, btnDoc, btnOpt).then((value) => {
    if (value === btnDoc) {
      const docUrl =
        'https://doc.qt.io/qtforpython-6/tools/pyside-project.html' +
        '#migrating-from-pyproject-to-pyproject-toml';

      void vscode.env.openExternal(vscode.Uri.parse(docUrl));
    } else if (value === btnOpt) {
      void setDoNotWarnOldStyleProjects(true);
    }
  });
}

async function setDoNotWarnOldStyleProjects(value: boolean) {
  await vscode.workspace
    .getConfiguration(consts.EXTENSION_ID)
    .update(
      consts.CONFIG_DO_NOT_WARN_OLD_PROJECTS,
      value,
      vscode.ConfigurationTarget.Global
    );
}

function getDoNotWarnOldStyleProjects(): boolean {
  return (
    vscode.workspace
      .getConfiguration(consts.EXTENSION_ID)
      .get<boolean>(consts.CONFIG_DO_NOT_WARN_OLD_PROJECTS) ?? false
  );
}

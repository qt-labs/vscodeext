// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as os from 'os';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';

import {
  exists,
  CoreKey,
  IsMacOS,
  OSExeSuffix,
  PySideEnvData,
  QtWorkspaceFeatures,
  createWrappedLogger,
  resolveConfiguration,
  searchForExeInQtInfo,
  QtWorkspaceConfigMessage
} from 'qt-lib';
import { coreAPI } from '@/extension';
import * as consts from './constants';
import { UiDesignerSource, UiDesignerInfo, UiDesignerExes } from './types';

const logger = createWrappedLogger('ui-designer-locator');

export class UiDesignerLocator {
  constructor(private readonly _folder: vscode.WorkspaceFolder) {}

  public async selectExe() {
    const linkText = 'Show logs';
    const linkCommand = `${consts.EXTENSION_ID}.${consts.COMMAND_SHOW_LOG}`;
    const linkShowLogs = `[${linkText}](command:${linkCommand})`;

    const all = await this.findPossibleDesigners();

    if (all.custom.filePath) {
      if (all.custom.valid) {
        return all.custom;
      } else {
        logger
          .text(`Could not locate custom Qt Widgets Designer (${linkShowLogs})`)
          .error({ throwError: true, showMessage: true });
        return undefined;
      }
    }

    const features = readWorkspaceFeatures(this._folder);
    if (features?.projectTypes.pyside) {
      if (all.pyside.valid) {
        return all.pyside;
      } else {
        logger
          .text(
            [
              'Could not locate Qt Widgets Designer.',
              'Make sure PySide6 is installed and accessible.',
              `(${linkShowLogs})`
            ].join(' ')
          )
          .error({ throwError: true, showMessage: true });
        return undefined;
      }
    }

    if (all.qtpaths.valid) {
      return all.qtpaths;
    } else {
      logger
        .text(
          [
            'Could not locate Qt Widgets Designer.',
            'Make sure your Qt C++ tools are configured correctly.',
            `(${linkShowLogs})`
          ].join(' ')
        )
        .error({ throwError: true, showMessage: true });
      return undefined;
    }
  }

  public async locate() {
    const all = await this.findPossibleDesigners();

    if (all.custom.valid) {
      return all.custom;
    } else {
      const features = readWorkspaceFeatures(this._folder);
      if (features?.projectTypes.pyside && all.pyside.valid) {
        return all.pyside;
      } else if (features?.projectTypes.cmake && all.qtpaths.filePath) {
        return all.qtpaths;
      }
    }

    return undefined;
  }

  public get configs() {
    return {
      folder: this._folder.name,
      customExe: readCustomExePath(this._folder) ?? '', // config
      qtpaths: readQtpaths(this._folder) ?? '', // qt-core
      pysideEnvData: readPySideEnvData(this._folder) ?? '', // qt-core
      qtInstallationRoot: readQtInstallationRoot(this._folder) ?? '', // qt-core
      workspaceFeatures: readWorkspaceFeatures(this._folder) ?? '' // qt-core
    };
  }

  public isAffectedBy(m: QtWorkspaceConfigMessage) {
    if (this._folder !== m.workspaceFolder) {
      return;
    }

    const relevantKeys = [
      CoreKey.PYSIDE_ENV_DATA,
      CoreKey.SELECTED_QT_PATHS,
      CoreKey.WORKSPACE_FEATURES
    ];

    return relevantKeys.some((key) => m.config.has(key));
  }

  public async findPossibleDesigners() {
    const toExecutable = async (
      source: UiDesignerSource,
      exePath: string
    ): Promise<UiDesignerInfo> => {
      const resolved = resolveConfiguration(exePath.trim());
      return {
        source,
        filePath: resolved,
        valid: (await checkExePath(resolved)) === Result.Ok
      };
    };

    const custom = readCustomExePath(this._folder) ?? '';
    const qtpaths = (await readFromQtpaths(this._folder)) ?? '';
    const pyside = readFromPySideEnvData(this._folder) ?? '';

    return {
      custom: await toExecutable('custom', custom),
      qtpaths: await toExecutable('qtpaths', qtpaths),
      pyside: await toExecutable('pyside', pyside)
    } satisfies UiDesignerExes;
  }
}

export function readCustomExePath(folder: vscode.WorkspaceFolder) {
  return vscode.workspace
    .getConfiguration(consts.CONF_SECTION, folder)
    .get<string>(consts.CONF_CUSTOM_WIDGETS_DESIGNER_EXE_PATH);
}

export function readPySideEnvData(folder: vscode.WorkspaceFolder) {
  const key = CoreKey.PYSIDE_ENV_DATA;
  return coreAPI?.getValue<string>(folder, key);
}

export function readFromPySideEnvData(folder: vscode.WorkspaceFolder) {
  const key = CoreKey.PYSIDE_ENV_DATA;
  const env = coreAPI?.getValue<PySideEnvData>(folder, key);
  const venvBin = env?.venvBinPath;
  return venvBin
    ? path.join(venvBin, 'pyside6-designer' + OSExeSuffix)
    : undefined;
}

export function locateCustomDesigner() {
  const custom = vscode.workspace
    .getConfiguration(consts.CONF_SECTION)
    .get<string>(consts.CONF_CUSTOM_WIDGETS_DESIGNER_EXE_PATH, '');

  if (custom.length !== 0) {
    if (fs.existsSync(custom)) {
      logger.text('Found custom designer').data('path', custom).info();
      return custom;
    }

    logger
      .text('Custom designer is assigned but invalid')
      .data('path', custom)
      .warn();
  }

  return '';
}

export async function locateDesignerFromVenvBinPaths(venvBinPath: string) {
  const candidate = path.join(venvBinPath, 'pyside6-designer' + OSExeSuffix);
  return (await exists(candidate)) ? candidate : undefined;
}

// helpers
function readQtpaths(folder: vscode.WorkspaceFolder) {
  const key = CoreKey.SELECTED_QT_PATHS;
  return coreAPI?.getValue<string>(folder, key);
}

function readQtInstallationRoot(folder: vscode.WorkspaceFolder) {
  const key = CoreKey.QT_INSTALLATION_ROOT;
  const v = coreAPI?.getValue<string>(folder, key);
  if (v) {
    return v;
  }

  return coreAPI?.getValue<string>(CoreKey.GLOBAL_WORKSPACE, key);
}

async function readFromQtpaths(folder: vscode.WorkspaceFolder) {
  const key = CoreKey.SELECTED_QT_PATHS;
  const qtpaths = coreAPI?.getValue<string>(folder, key);
  const info = qtpaths && coreAPI?.getQtInfoFromPath(qtpaths).info;
  if (info) {
    return searchForExeInQtInfo(info, getDesignerExePathFromBin);
  }

  return undefined;
}

function readWorkspaceFeatures(folder: vscode.WorkspaceFolder) {
  const key = CoreKey.WORKSPACE_FEATURES;
  return coreAPI?.getValue<QtWorkspaceFeatures>(folder, key);
}

function getDesignerExePathFromBin(selectedQtBinPath: string) {
  return path.join(
    selectedQtBinPath,
    IsMacOS ? 'Designer.app/Contents/MacOS/Designer' : 'designer' + OSExeSuffix
  );
}

const enum Result {
  Ok,
  InvalidInput,
  NullByte,
  NotAbsolute,
  NotAccessible,
  NotAFile,
  NotExecutableExtension
}

async function checkExePath(input: string): Promise<Result> {
  if (!input.trim()) {
    return Result.InvalidInput;
  }

  if (input.includes('\0')) {
    return Result.NullByte;
  }

  const normalized = path.normalize(input);
  if (!path.isAbsolute(normalized)) {
    return Result.NotAbsolute;
  }

  try {
    await fsp.access(normalized, fs.constants.F_OK | fs.constants.X_OK);
  } catch {
    return Result.NotAccessible;
  }

  if (!(await fsp.stat(normalized)).isFile()) {
    return Result.NotAFile;
  }

  if (os.platform() === 'win32') {
    const args = ['.exe', '.cmd', '.bat', '.com'];
    if (!args.includes(path.extname(normalized).toLowerCase())) {
      return Result.NotExecutableExtension;
    }
  }

  return Result.Ok;
}

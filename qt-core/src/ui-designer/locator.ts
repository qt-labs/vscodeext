// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as os from 'os';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';

import {
  IsMacOS,
  OSExeSuffix,
  createWrappedLogger,
  resolveConfiguration,
  searchForExeInQtInfo,
  CoreAPI,
  CoreKey,
  PySideEnvData,
  QtWorkspaceFeatures
} from 'qt-lib';
import { coreAPI } from '@/extension';
import * as consts from './constants';

type UiDesignerOrigin = 'custom' | 'qtpaths' | 'pyside';
interface UiDesignerCandidate {
  origin: UiDesignerOrigin;
  filePath: string;
  valid: boolean;
}

interface UiDesignerCandidates {
  custom: UiDesignerCandidate;
  pyside: UiDesignerCandidate;
  qtpaths: UiDesignerCandidate;
}

const logger = createWrappedLogger('ui-designer-locator');

export class UiDesignerLocator {
  constructor(private readonly _folder: vscode.WorkspaceFolder) {}

  public async select(): Promise<UiDesignerCandidate | undefined> {
    const all = await this._findAllCandidates();

    if (all.custom.filePath) {
      if (!all.custom.valid) {
        this._fail('Cannot locate custom Qt Widgets Designer', all);
        return undefined;
      }

      return all.custom;
    }

    const features = this._readWorkspaceFeatures();
    if (features?.projectTypes.pyside) {
      if (!all.pyside.valid) {
        this._fail(
          [
            'Cannot locate Qt Widgets Designer.',
            'Make sure PySide6 is installed and accessible.'
          ].join(' '),
          all
        );
        return undefined;
      }

      return all.pyside;
    }

    if (!all.qtpaths.valid) {
      this._fail(
        [
          'Cannot locate Qt Widgets Designer.',
          'Make sure your Qt C++ tools are configured correctly.'
        ].join(' '),
        all
      );
      return undefined;
    }

    return all.qtpaths;
  }

  // privates
  private async _findAllCandidates() {
    return {
      custom: await this.findCandidate('custom'),
      pyside: await this.findCandidate('pyside'),
      qtpaths: await this.findCandidate('qtpaths')
    } satisfies UiDesignerCandidates;
  }

  private async findCandidate(origin: UiDesignerOrigin) {
    let valid = false;
    let filePath = '';

    const raw = await this.getExpectedExePath(origin);
    if (raw) {
      filePath = resolveConfiguration(raw);
      valid = (await checkExeStatus(filePath)) === ExeCheckResult.Ok;
    }

    return {
      origin,
      filePath,
      valid
    } satisfies UiDesignerCandidate;
  }

  private async getExpectedExePath(origin: UiDesignerOrigin) {
    switch (origin) {
      case 'custom':
        return vscode.workspace
          .getConfiguration(consts.CONF_SECTION, this._folder)
          .get<string>(consts.CONF_CUSTOM_WIDGETS_DESIGNER_EXE_PATH);

      case 'qtpaths': {
        const core = new QtCoreValueReader(coreAPI, this._folder);
        const qtpaths = core.selectedQtpaths;
        const info = qtpaths && coreAPI?.getQtInfoFromPath(qtpaths).info;
        if (info) {
          return searchForExeInQtInfo(info, getDesignerExePathFromBin);
        }
        break;
      }

      case 'pyside': {
        const core = new QtCoreValueReader(coreAPI, this._folder);
        const venvBin = core.pysideEnvData?.venvBinPath;
        if (venvBin) {
          return path.join(venvBin, 'pyside6-designer' + OSExeSuffix);
        }
        break;
      }

      default:
        break;
    }

    return undefined;
  }

  private _readWorkspaceFeatures() {
    return new QtCoreValueReader(coreAPI, this._folder).workspaceFeatures;
  }

  private _fail(message: string, all: UiDesignerCandidates) {
    const linkText = 'Show logs';
    const linkCommand = `${consts.EXTENSION_ID}.${consts.COMMAND_SHOW_LOG}`;
    const link = `[${linkText}](command:${linkCommand})`;
    const fallback = '<none>';

    logger
      .text(message)
      .data('folder', this._folder.name || fallback)
      .data('custom setting', all.custom.filePath || fallback)
      .data('qtpaths binary', all.qtpaths.filePath || fallback)
      .data('PySide configuration', all.pyside.filePath || fallback)
      .error({ multipleLine: true, showMessage: false });

    void vscode.window.showErrorMessage(message + ` (${link})`);
  }
}

// helpers
function getDesignerExePathFromBin(selectedQtBinPath: string) {
  return path.join(
    selectedQtBinPath,
    IsMacOS ? 'Designer.app/Contents/MacOS/Designer' : 'designer' + OSExeSuffix
  );
}

const enum ExeCheckResult {
  Ok,
  InvalidInput,
  NullByte,
  NotAbsolute,
  NotAccessible,
  NotAFile,
  NotExecutableExtension
}

async function checkExeStatus(input: string): Promise<ExeCheckResult> {
  if (!input.trim()) {
    return ExeCheckResult.InvalidInput;
  }

  if (input.includes('\0')) {
    return ExeCheckResult.NullByte;
  }

  const normalized = path.normalize(input);
  if (!path.isAbsolute(normalized)) {
    return ExeCheckResult.NotAbsolute;
  }

  try {
    await fsp.access(normalized, fs.constants.F_OK | fs.constants.X_OK);
  } catch {
    return ExeCheckResult.NotAccessible;
  }

  if (!(await fsp.stat(normalized)).isFile()) {
    return ExeCheckResult.NotAFile;
  }

  if (os.platform() === 'win32') {
    const args = ['.exe', '.cmd', '.bat', '.com'];
    if (!args.includes(path.extname(normalized).toLowerCase())) {
      return ExeCheckResult.NotExecutableExtension;
    }
  }

  return ExeCheckResult.Ok;
}

class QtCoreValueReader {
  constructor(
    private readonly _api: CoreAPI | undefined,
    private readonly _folder: vscode.WorkspaceFolder
  ) {}

  get pysideEnvData(): PySideEnvData | undefined {
    const key = CoreKey.PYSIDE_ENV_DATA;
    return this._api?.getValue<PySideEnvData>(this._folder, key);
  }

  get selectedQtpaths(): string | undefined {
    const key = CoreKey.SELECTED_QT_PATHS;
    return this._api?.getValue<string>(this._folder, key);
  }

  get workspaceFeatures(): QtWorkspaceFeatures | undefined {
    const key = CoreKey.WORKSPACE_FEATURES;
    return this._api?.getValue<QtWorkspaceFeatures>(this._folder, key);
  }
}

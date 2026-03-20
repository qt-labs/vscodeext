// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import * as vscode from 'vscode';
import {
  PythonExtension as PyApi,
  ResolvedEnvironment as PyEnv
} from '@vscode/python-extension';

import { isError, OSExeSuffix, createLogger } from 'qt-lib';
import { PipPackageInfo } from './types.js';
import { PySideCommandRunner } from './runner.mjs';
import * as utils from './utils.js';
import * as consts from './constants.js';

const logger = createLogger('env');

export class PySideEnv {
  private _pyEnv?: PyEnv | undefined;
  private _activeFSWatcher: vscode.FileSystemWatcher | undefined;

  constructor(private readonly _folder: vscode.WorkspaceFolder) {}

  public dispose() {
    this._disposeActiveFSWatcher();
  }

  public isVenv(): boolean {
    return this._pyEnv?.environment?.type === 'VirtualEnvironment';
  }

  get venvName(): string | undefined {
    return this._pyEnv?.environment?.name;
  }

  get venvBinPath(): string {
    const root = this._pyEnv?.executable.sysPrefix ?? '';
    return root
      ? utils.toForwardSlash(path.join(root, consts.VENV_BIN_DIR))
      : '';
  }

  get interpreterPath(): string | undefined {
    return this._pyEnv?.executable.uri?.fsPath;
  }

  public async refresh(pyApi: PyApi) {
    const allEnvs = pyApi.environments;
    const activeEnvPath = allEnvs.getActiveEnvironmentPath(this._folder);
    this._pyEnv = await allEnvs.resolveEnvironment(activeEnvPath);
    this._setupWatcher(pyApi);
  }

  public async readPackageInfo(name: string) {
    return runPipShowAndParseInfo(this, name);
  }

  public async readPySide6PackageInfo() {
    return runPipShowAndParseInfo(this, 'PySide6');
  }

  private _setupWatcher(pyApi: PyApi) {
    const folder = this._folder;
    const isVenv = this._pyEnv?.environment?.type === 'VirtualEnvironment';

    this._disposeActiveFSWatcher();

    if (isVenv) {
      const sysPrefix = this._pyEnv?.executable.sysPrefix;
      if (sysPrefix) {
        const pattern = new vscode.RelativePattern(
          vscode.Uri.file(sysPrefix),
          '/'
        );
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);
        watcher.onDidDelete(() => {
          void pyApi.environments.updateActiveEnvironmentPath('', folder);
          this._pyEnv = undefined;
          this._disposeActiveFSWatcher();
        });

        this._activeFSWatcher = watcher;
      }
      return;
    }

    const pythonPathRel = path.join(
      '.venv',
      consts.VENV_BIN_DIR,
      'python' + OSExeSuffix
    );
    const pattern = new vscode.RelativePattern(folder.uri, pythonPathRel);
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    watcher.onDidCreate(() => {
      const pythonPath = path.join(folder.uri.fsPath, pythonPathRel);
      void pyApi.environments.updateActiveEnvironmentPath(pythonPath, folder);
      this._disposeActiveFSWatcher();
    });

    this._activeFSWatcher = watcher;
  }

  private _disposeActiveFSWatcher() {
    if (this._activeFSWatcher) {
      this._activeFSWatcher.dispose();
      this._activeFSWatcher = undefined;
    }
  }
}

// helper
async function runPipShowAndParseInfo(env: PySideEnv, name: string) {
  const parsedOutput: Record<string, string> = {};

  try {
    // expected output from 'pip show <package>'
    //
    // Version: 6.10.0
    // Summary: Python bindings for the Qt cross-platform application and UI framework
    // Home-page:
    // Author:
    // Author-email: Qt for Python Team <pyside@qt-project.org>
    // License: LGPL-3.0-only OR GPL-2.0-only OR GPL-3.0-only
    // Location: /Users/bencho/ws_temp/myenv/lib/python3.9/site-packages
    // Requires: PySide6_Essentials, PySide6_Addons, shiboken6
    // Required-by:

    const logIndented = (line: string) => {
      logger.info(' ', line);
    };

    const runner = new PySideCommandRunner(env);
    runner.onStdout(logIndented);
    runner.onStderr(logIndented);

    const lines = await runner.run(`pip show ${name}`, { useVenv: true, timeoutMs: 5000 });
    lines.forEach((line) => {
      const [key, value] = line.split(': ');
      if (key && value) {
        parsedOutput[key.trim()] = value.trim();
      }
    });
  } catch (e) {
    logger.error(' ', isError(e) ? e.message : String(e));
    return undefined;
  }

  return {
    version: parsedOutput.Version ?? '',
    location: parsedOutput.Location ?? ''
  } as PipPackageInfo;
}

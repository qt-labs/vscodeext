// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import * as vscode from 'vscode';
import { Environment } from '@vscode/python-extension';

import { isError, OSExeSuffix } from 'qt-lib';
import { PySidePackageInfo } from './types';
import { PySideCommandRunner } from './runner';
import { pyApi } from './extension';
import * as utils from './utils';
import * as consts from './constants';

export class PySideEnv {
  private _disposables: vscode.Disposable[] = [];

  constructor(
    private readonly _folder: vscode.WorkspaceFolder,
    private _pyEnv?: Environment
  ) {
    const folder = this._folder;
    const isVenv = this._pyEnv?.environment?.type === 'VirtualEnvironment';

    if (isVenv) {
      const sysPrefix = this._pyEnv?.executable.sysPrefix;
      if (sysPrefix) {
        const pattern = new vscode.RelativePattern(
          vscode.Uri.file(sysPrefix),
          '/'
        );
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);
        watcher.onDidDelete(() => {
          watcher.dispose();
          this._pyEnv = undefined;
          if (pyApi) {
            void pyApi.environments.updateActiveEnvironmentPath('', folder);
          }
        });
        this._disposables.push(watcher);
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
      watcher.dispose();
      if (pyApi) {
        const pythonPath = path.join(folder.uri.fsPath, pythonPathRel);
        void pyApi.environments.updateActiveEnvironmentPath(pythonPath, folder);
      }
    });
    this._disposables.push(watcher);
  }

  public dispose() {
    this._disposables.forEach((w) => {
      w.dispose();
    });
    this._disposables = [];
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

  public async readPySide6PackageInfo(outputHandler?: (line: string) => void) {
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

      const runner = new PySideCommandRunner(this);
      runner.onStdout(outputHandler);
      runner.onStderr(outputHandler);

      const lines = await runner.run(`pip show PySide6`, { useVenv: true });
      lines.forEach((line) => {
        const [key, value] = line.split(': ');
        if (key && value) {
          parsedOutput[key.trim()] = value.trim();
        }
      });
    } catch (e) {
      outputHandler?.(isError(e) ? e.message : String(e));
      return undefined;
    }

    return {
      version: parsedOutput.Version ?? '',
      location: parsedOutput.Location ?? ''
    } as PySidePackageInfo;
  }
}

// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as os from 'os';
import * as fs from 'fs/promises';
import * as vscode from 'vscode';

import { QtcliAction, openUri, logger, errorString } from '@/qtcli/common';

export class QtcliRunner {
  private _workingDir = os.homedir();
  private _qtcliExecPath = '';
  private _terminal: vscode.Terminal | undefined = undefined;
  private _fsDisposables: vscode.Disposable[] = [];
  private _terminalDisposables: vscode.Disposable[] = [];

  dispose() {
    if (this._terminal) {
      this._terminal.dispose();
      this._terminal = undefined;

      for (const d of this._terminalDisposables) {
        d.dispose();
      }

      this._terminalDisposables = [];
      this._disposeFsWatcher();
    }
  }

  private _disposeFsWatcher() {
    for (const d of this._fsDisposables) {
      d.dispose();
    }

    this._fsDisposables = [];
  }

  public setWorkingDir(dir: string) {
    if (this._workingDir !== dir) {
      this._workingDir = dir;
      this.dispose();
    }
  }

  public setQtcliExePath(fullPath: string) {
    this._qtcliExecPath = fullPath;
  }

  public async run(action: QtcliAction, arg: string) {
    try {
      await fs.mkdir(this._workingDir, { recursive: true });
      this._disposeFsWatcher();
      this._setupFsWatcher(action, arg);

      if (action === QtcliAction.NewProject) {
        this._runQtcli(['new', arg]);
      } else {
        this._runQtcli(['new-file', arg]);
      }
    } catch (e) {
      logger.error('cannot run qtcli:', errorString(e));
    }
  }

  private _setupFsWatcher(action: QtcliAction, arg: string) {
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(
        this._workingDir,
        action === QtcliAction.NewFile ? `${arg}.*` : `${arg}/`
      )
    );

    this._fsDisposables.push(watcher);
    this._fsDisposables.push(
      watcher.onDidCreate((uri) => {
        void openUri(uri);
        this._disposeFsWatcher();
      })
    );
  }

  private _runQtcli(args: string[]) {
    this._ensureTerminalIsValid();

    if (this._terminal) {
      this._terminal.show();
      this._terminal.sendText(`${this._qtcliExecPath} ${args.join(' ')}`);
    }
  }

  private _ensureTerminalIsValid() {
    if (this._terminal) {
      return;
    }

    this._terminal = vscode.window.createTerminal({
      name: 'qtcli',
      cwd: this._workingDir
    });

    this._terminalDisposables.push(
      vscode.window.onDidCloseTerminal((t) => {
        if (t === this._terminal) {
          this.dispose();
        }
      }),

      vscode.window.onDidEndTerminalShellExecution((e) => {
        if (e.terminal === this._terminal && e.exitCode === 0) {
          this._terminal.hide();
        }
      })
    );
  }
}

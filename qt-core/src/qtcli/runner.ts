// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as os from 'os';
import * as vscode from 'vscode';

import {
  QtcliAction,
  logger,
  errorString,
  qtcliSubCommands
} from '@/qtcli/common';

export class QtcliRunner {
  private _qtcliExecPath = '';
  private _terminal: vscode.Terminal | undefined = undefined;
  private _terminalDisposables: vscode.Disposable[] = [];

  dispose() {
    if (this._terminal) {
      this._terminal.dispose();
      this._terminal = undefined;

      for (const d of this._terminalDisposables) {
        d.dispose();
      }

      this._terminalDisposables = [];
    }
  }

  public setQtcliExePath(fullPath: string) {
    this._qtcliExecPath = fullPath;
  }

  public run(action: QtcliAction, arg: string) {
    try {
      const subCommand = qtcliSubCommands[action];
      if (subCommand) {
        this._runQtcli([subCommand, arg]);
        return;
      }

      throw new Error('action is invalid');
    } catch (e) {
      logger.error('cannot run qtcli:', errorString(e));
    }
  }

  private _runQtcli(args: string[]) {
    this._ensureTerminalIsValid();

    if (this._terminal) {
      const safePath = this._qtcliExecPath.replace(/\\/g, '/');
      this._terminal.sendText(`${safePath} ${args.join(' ')}`);
    }
  }

  private _ensureTerminalIsValid() {
    if (this._terminal) {
      return;
    }

    this._terminal = vscode.window.createTerminal({
      name: 'qtcli',
      cwd: os.homedir()
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

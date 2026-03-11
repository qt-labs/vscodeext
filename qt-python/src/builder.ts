// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import * as childProcess from 'child_process';

import { IsWindows } from 'qt-lib';

export class PySideCommandBuilder {
  private _venvBinPath: string | undefined;
  private _useVenv: boolean | undefined;
  private _cwd: string | undefined;

  public venvBinPath(p: string | undefined) {
    this._venvBinPath = p;
    return this;
  }

  public useVenv(use: boolean | undefined) {
    this._useVenv = use;
    return this;
  }

  public cwd(cwd: string | undefined) {
    this._cwd = cwd;
    return this;
  }

  public build(command: string) {
    const all: string[] = [command];

    if (this._cwd) {
      all.unshift(`cd ${enclosePath(this._cwd)}`);
    }

    if (this._useVenv) {
      all.unshift(makeVenvActivationCommand(this._venvBinPath ?? '<no-venv>'));
    }

    return {
      shellPath: resolveShellPath(),
      shellArgs: [IsWindows ? '/c' : '-c'],
      commandLine: all.join(' && ')
    };
  }
}

// helpers
function resolveShellPath(): string {
  if (IsWindows) {
    return process.env.ComSpec ?? 'C:\\Windows\\System32\\cmd.exe';
  }

  const result = childProcess.spawnSync('command -v bash', { shell: true });
  const found = result.stdout.toString().trim();
  return result.status === 0 && found ? found : '/bin/bash';
}

function makeVenvActivationCommand(venvBinPath: string): string {
  const script = enclosePath(
    path.join(venvBinPath, IsWindows ? 'activate.bat' : 'activate')
  );

  return IsWindows ? script : `source ${script}`;
}

function enclosePath(s: string) {
  return IsWindows ? `"${s}"` : `'${s}'`;
}

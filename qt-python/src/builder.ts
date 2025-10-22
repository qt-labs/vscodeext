// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import * as childProcess from 'child_process';

import { IsWindows } from 'qt-lib';
import { PySideEnv } from './env';

export interface PySideCommandBuildOptions {
  useVenv?: boolean;
  cwd?: string;
}

export class PySideCommandBuilder {
  private readonly _shellPath: string;
  private readonly _shellArgs: string[];
  private readonly _venvActivationCommand: string;

  constructor(
    private readonly _env: PySideEnv,
    private readonly _options?: PySideCommandBuildOptions
  ) {
    this._shellPath = resolveShellPath();
    this._shellArgs = [IsWindows ? '/c' : '-c'];
    this._venvActivationCommand = resolveVenvActivationCommand(this._env);
  }

  get shellPath(): string {
    return this._shellPath;
  }

  get shellArgs(): string[] {
    return this._shellArgs;
  }

  get venvActivationCommand(): string {
    return this._venvActivationCommand;
  }

  public build(command: string) {
    const all: string[] = [command];

    if (this._options?.cwd) {
      all.unshift(`cd ${enclosePath(this._options.cwd)}`);
    }

    if (this._options?.useVenv && this._venvActivationCommand) {
      all.unshift(this._venvActivationCommand);
    }

    return all.join(' && ');
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

function resolveVenvActivationCommand(env: PySideEnv): string {
  const bin = env.venvBinPath;
  if (!bin) {
    return '';
  }

  const script = enclosePath(
    path.join(bin, IsWindows ? 'activate.bat' : 'activate')
  );

  return IsWindows ? script : `source ${script}`;
}

function enclosePath(s: string) {
  return IsWindows ? `"${s}"` : `'${s}'`;
}

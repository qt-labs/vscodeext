// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import { spawn, SpawnOptions, ChildProcess, execSync } from 'child_process';

import { createLogger, IsWindows, IsLinux } from 'qt-lib';

const logger = createLogger('utils');

export class QtProcess extends ChildProcess {
  override kill(signal?: NodeJS.Signals | number): boolean {
    if (!this.pid) {
      return false;
    }

    logger.info('Killing process:', this.pid.toString());

    if (IsWindows) {
      try {
        execSync(`taskkill /pid ${this.pid} /T /F`, {
          stdio: 'ignore'
        });
        return true;
      } catch {
        return false;
      }
    } else if (IsLinux) {
      try {
        process.kill(-this.pid, signal);
        return true;
      } catch {
        return false;
      }
    } else {
      return super.kill(signal);
    }
  }
}

export async function spawnProcessForTool(
  command: string,
  additionalArgs: string[] = []
): Promise<QtProcess> {
  const quoteArg = (arg: string): string => {
    // Escape double quotes and wrap the argument in quotes
    const escaped = arg.replace(/(["\\])/g, '\\$1');
    return `"${escaped}"`;
  };
  if (additionalArgs.length > 0) {
    command += ` ${additionalArgs.map(quoteArg).join(' ')}`;
  }
  logger.info('Starting program:', command);
  let options: SpawnOptions = {
    shell: true
  };
  if (IsLinux) {
    options = {
      ...options,
      detached: true
    };
  }
  if (IsWindows) {
    const dllDirs = await vscode.commands.executeCommand(`qt-cpp.qtDir`);
    if (dllDirs !== undefined) {
      const env = { ...process.env };
      env.PATH = `${dllDirs as string};${env.PATH}`;
      options = {
        ...options,
        env: env
      };
    }
  }
  const childProcess = spawn(command, options);

  // Handle spawn errors
  childProcess.on('error', (error) => {
    logger.error('Failed to spawn process:', String(error));
  });

  Object.setPrototypeOf(childProcess, QtProcess.prototype);
  return childProcess as QtProcess;
}

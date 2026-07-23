// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import { spawn, SpawnOptions, ChildProcess, execSync } from 'child_process';

import { createLogger, IsWindows, IsLinux } from 'qt-lib';

const logger = createLogger('utils');

export function prependPathEntries(
  environment: NodeJS.ProcessEnv,
  pathEntries: readonly string[],
  platform: NodeJS.Platform = process.platform
) {
  if (pathEntries.length === 0) {
    return;
  }

  const delimiter = platform === 'win32' ? ';' : ':';
  const pathKeys = Object.keys(environment).filter(
    (name) => name.toLowerCase() === 'path'
  );
  const pathKey =
    platform === 'win32'
      ? pathKeys.find((name) => name === 'PATH') ?? pathKeys[0] ?? 'PATH'
      : 'PATH';
  const inheritedPath = environment[pathKey] ?? '';

  for (const duplicatePathKey of pathKeys) {
    if (duplicatePathKey !== pathKey) {
      delete environment[duplicatePathKey];
    }
  }
  environment[pathKey] =
    `${pathEntries.join(delimiter)}${delimiter}${inheritedPath}`;
}

export class QtProcess extends ChildProcess {
  override kill(signal?: NodeJS.Signals | number): boolean {
    if (!this.pid) {
      return false;
    }

    logger.info('Killing process:', this.pid.toString());

    if (IsWindows) {
      try {
        execSync(`taskkill /pid ${this.pid.toString()} /T /F`, {
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
    const env = { ...process.env };
    const pathEntries: string[] = [];

    try {
      const dllDirs = await vscode.commands.executeCommand(`qt-cpp.qtDir`);
      if (typeof dllDirs === 'string' && dllDirs.length > 0) {
        pathEntries.push(dllDirs);
      }
    } catch {
    }

    if (pathEntries.length > 0) {
      prependPathEntries(env, pathEntries);
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

export async function spawnProgramForTool(
  program: string,
  args: string[] = [],
  optionsOverrides?: {
    pathEntries?: readonly string[];
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    sanitizeVsCodeEnv?: boolean;
  }
): Promise<QtProcess> {
  logger.info(
    'Starting program:',
    [program, ...args].join(' ')
  );

  let options: SpawnOptions = {
    shell: false
  };

  if (optionsOverrides?.cwd) {
    options = {
      ...options,
      cwd: optionsOverrides.cwd
    };
  }

  if (IsLinux) {
    options = {
      ...options,
      detached: true
    };
  }

  const env = { ...process.env, ...optionsOverrides?.env };

  const pathEntries: string[] = [];

  if (optionsOverrides?.pathEntries) {
    pathEntries.push(...optionsOverrides.pathEntries);
  }

  if (IsWindows) {
    if (optionsOverrides?.sanitizeVsCodeEnv) {
      // Do not leak VS Code/Electron launch variables into preview applications.
      // In particular, ELECTRON_RUN_AS_NODE can make a spawned app-host behave
      // like a Node/Electron helper instead of a normal Qt Bridge executable.
      const removedNames = Object.keys(env).filter((name) => {
        const upperName = name.toUpperCase();
        return (
          upperName.startsWith('ELECTRON_')
          || upperName.startsWith('VSCODE_')
          || upperName === 'NODE_OPTIONS'
          || upperName === 'NODE_CHANNEL_FD'
          || upperName === 'NODE_UNIQUE_ID'
        );
      });
      for (const name of removedNames) {
        delete env[name];
      }
    }

    try {
      const dllDirs = await vscode.commands.executeCommand(`qt-cpp.qtDir`);
      if (typeof dllDirs === 'string' && dllDirs.length > 0) {
        pathEntries.push(dllDirs);
      }
    } catch {
    }

  }

  if (pathEntries.length > 0) {
    prependPathEntries(env, pathEntries);
  }

  if (optionsOverrides?.env || optionsOverrides?.sanitizeVsCodeEnv || pathEntries.length > 0) {
    options = { ...options, env: env };
  }

  const childProcess = spawn(program, args, options);

  childProcess.on('error', (error) => {
    logger.error('Failed to spawn process:', String(error));
  });

  Object.setPrototypeOf(childProcess, QtProcess.prototype);
  return childProcess as QtProcess;
}

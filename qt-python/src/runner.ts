// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as childProcess from 'child_process';

import { createLogger } from 'qt-lib';
import { PySideEnv } from './env';
import { PySideCommandBuilder } from './builder';

const logger = createLogger('runner');

export interface PySideCommandRunOptions {
  useVenv?: boolean;
  cwd?: string;
}

export class PySideCommandRunner {
  private _onStdout: ((line: string) => void) | undefined;
  private _onStderr: ((line: string) => void) | undefined;

  constructor(private readonly _env: PySideEnv) {}

  public onStdout(f: ((line: string) => void) | undefined) {
    this._onStdout = f;
  }

  public onStderr(f: ((line: string) => void) | undefined) {
    this._onStderr = f;
  }

  public async run(command: string, options?: PySideCommandRunOptions) {
    const cmd = new PySideCommandBuilder()
      .venvBinPath(this._env.venvBinPath)
      .useVenv(options?.useVenv)
      .cwd(options?.cwd)
      .build(command);

    logger.info('Running command');
    logger.info(`- shell: ${cmd.shellPath}`);
    logger.info(`- venv activation: ${String(options?.useVenv ?? false)}`);
    logger.info(`- command: ${cmd.commandLine}`);

    const proc = childProcess.spawn(cmd.commandLine, { shell: cmd.shellPath });
    const outPromise = streamToLines(proc.stdout, this._onStdout);
    const errPromise = streamToLines(proc.stderr, this._onStderr);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        proc.kill();
        reject(new Error('Process timed out after 5 seconds'));
      }, 3_000);

      proc.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
      proc.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(`Process exited with code ${code?.toString() ?? ''}`));
      });
    });

    const out = await outPromise;
    const err = await errPromise;
    void err;

    return out;
  }
}

// helpers
type Stream = NodeJS.ReadableStream;
type Callback = ((line: string) => void) | undefined;

async function streamToLines(stream: Stream, callback: Callback) {
  let leftover = '';
  const lines: string[] = [];

  for await (const chunk of stream) {
    const text = leftover + chunk.toString();
    const parts = text.split('\n');
    leftover = parts.pop() ?? '';

    for (const line of parts) {
      const trimmed = line.trim();
      lines.push(trimmed);
      callback?.(trimmed);
    }
  }

  if (leftover.trim()) {
    const trimmed = leftover.trim();
    lines.push(trimmed);
    callback?.(trimmed);
  }

  return lines;
}

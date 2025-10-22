// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as childProcess from 'child_process';

import { createLogger } from 'qt-lib';
import { PySideEnv } from './env';
import { PySideCommandBuilder, PySideCommandBuildOptions } from './builder';

const logger = createLogger('runner');

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

  public async run(command: string, options?: PySideCommandBuildOptions) {
    const builder = new PySideCommandBuilder(this._env, options);
    const commandLine = builder.build(command);

    logger.info('Running command');
    logger.info(`- shell: ${builder.shellPath}`);
    logger.info(`- command: ${commandLine}`);
    logger.info(
      '- venv activation: ' +
        `${options?.useVenv ?? false}, ` +
        builder.venvActivationCommand
    );

    const proc = childProcess.spawn(commandLine, { shell: builder.shellPath });
    const outPromise = streamToLines(proc.stdout, this._onStdout);
    const errPromise = streamToLines(proc.stderr, this._onStderr);

    await new Promise<void>((resolve, reject) => {
      proc.on('error', reject);
      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(`Process exited with code ${code}`));
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

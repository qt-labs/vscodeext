// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import * as childProcess from 'child_process';

import { createLogger } from 'qt-lib';
import { findQtcliExePath } from '@/qtcli/commands';

let qtcliExePath: string | undefined;
const logger = createLogger('qtcli-runner');

export async function startQtcliServer(extensionUri: vscode.Uri) {
  qtcliExePath ??= await findQtcliExePath(extensionUri);
  if (!qtcliExePath) {
    logger.error('Cannot locate qtcli executable');
    return;
  }

  await runQtcli(qtcliExePath, ['server', 'start'], onOutputFromQtcli);
}

// helpers
function onOutputFromQtcli(line: string) {
  // eslint-disable-next-line no-control-regex
  const removeAnsiColor = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, '');
  logger.info(removeAnsiColor(line));
}

async function runQtcli(
  command: string,
  args: string[],
  onOutput: (line: string) => void
) {
  const proc = childProcess.spawn(command, args);
  const outPromise = streamToLines(proc.stdout, onOutput);
  const errPromise = streamToLines(proc.stderr, onOutput);

  await new Promise<void>((resolve, reject) => {
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Process exited with code ${String(code)}`));
    });
  });

  const out = await outPromise;
  const err = await errPromise;
  void err;

  return out;
}

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

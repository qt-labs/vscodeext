// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

interface ProgressData {
  message?: string;
  increment?: number;
}

export type Progress = vscode.Progress<ProgressData>;

export class ProgressUpdater {
  private _currentBytes = 0;
  private _currentPercentage = 0;

  constructor(
    private readonly _progress: Progress,
    private readonly _maxBytes: number
  ) {}

  public increase(bytes: number) {
    if (this._maxBytes <= 0) {
      return;
    }

    const newBytes = this._currentBytes + bytes;
    const newPercentage = Math.round((newBytes / this._maxBytes) * 100);
    this._progress.report({
      message: createMessage(newBytes, this._maxBytes),
      increment: newPercentage - this._currentPercentage
    });

    this._currentBytes = newBytes;
    this._currentPercentage = newPercentage;
  }
}

// helpers
function createMessage(currentBytes: number, maxBytes: number) {
  const newMiB = (currentBytes / 1024 / 1024).toFixed(1);
  const maxMiB = (maxBytes / 1024 / 1024).toFixed(1);
  return `${newMiB}/${maxMiB} MiB`;
}

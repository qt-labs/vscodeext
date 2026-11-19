// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { createHash } from 'crypto';

export class PythonSaveMonitor {
  private readonly _hashes = new Map<string, string>();
  private readonly _pending = new Set<string>();
  private _timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly _debounceMs: number,
    private readonly _onSave: (files: string[]) => void,
    private readonly _readFile: (file: string) => Buffer
  ) {}

  watch(file: string, previousContent?: Buffer) {
    const content = previousContent ?? this._readFile(file);
    this._hashes.set(file, hashContent(content));
  }

  save(file: string) {
    const content = this._readFile(file);
    const hash = hashContent(content);
    if (this._hashes.get(file) === hash) {
      return false;
    }

    this._hashes.set(file, hash);
    this._pending.add(file);
    clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      const files = [...this._pending];
      this._pending.clear();
      this._timer = undefined;
      this._onSave(files);
    }, this._debounceMs);
    return true;
  }

  dispose() {
    clearTimeout(this._timer);
    this._timer = undefined;
    this._pending.clear();
    this._hashes.clear();
  }
}

function hashContent(content: Buffer) {
  return createHash('sha256').update(content).digest('hex');
}

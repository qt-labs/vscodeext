// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs';
import * as path from 'path';

export class FolderLock {
  private readonly _lockFile: string;

  constructor(targetDir: string) {
    this._lockFile = path.join(targetDir, '.lock');
  }

  acquire(): boolean {
    try {
      fs.mkdirSync(path.dirname(this._lockFile), { recursive: true });

      const fd = fs.openSync(this._lockFile, 'wx');
      fs.writeSync(fd, String(process.pid));
      fs.closeSync(fd);
      return true;
    } catch (e: unknown) {
      if (e instanceof Error && 'code' in e) {
        if ((e as NodeJS.ErrnoException).code === 'EEXIST') {
          return false;
        }
      }
      throw e;
    }
  }

  release(): void {
    try {
      fs.unlinkSync(this._lockFile);
    } catch (e) {
      void e;
    }
  }

  isStale(): boolean {
    try {
      const pid = parseInt(fs.readFileSync(this._lockFile, 'utf-8'));
      process.kill(pid, 0);
      return false;
    } catch (e: unknown) {
      if (e instanceof Error && 'code' in e) {
        if ((e as NodeJS.ErrnoException).code === 'ESRCH') {
          return true;
        }
      }
      return false;
    }
  }

  acquireWithStaleCheck(): boolean {
    if (fs.existsSync(this._lockFile) && this.isStale()) {
      fs.unlinkSync(this._lockFile);
    }
    return this.acquire();
  }

  async withLock(fn: () => Promise<void>): Promise<void> {
    if (!this.acquireWithStaleCheck()) {
      throw new Error('Another instance is already working on this folder.');
    }
    try {
      await fn();
    } finally {
      this.release();
    }
  }
}

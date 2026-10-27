// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import { workspace, Disposable, EventEmitter, RelativePattern } from 'vscode';

import { fsFile } from '@/fs-utils';

export class DocViewerCssManager implements Disposable {
  private _content = '';
  private _filePathAbs = '';

  private readonly _changedEmitter = new EventEmitter<void>();
  private _watchDisposable: Disposable | undefined;

  public dispose() {
    this._watchDisposable?.dispose();
    this._watchDisposable = undefined;
  }

  public get cssContent() {
    return this._content;
  }

  public get onCssChanged() {
    return this._changedEmitter.event;
  }

  public setCssPath(absPath: string) {
    if (absPath === this._filePathAbs) {
      return;
    }

    this._filePathAbs = absPath;
    this._watch();
    this._loadCss();
    this._changedEmitter.fire();
  }

  private _watch() {
    this._watchDisposable?.dispose();
    this._watchDisposable = undefined;

    if (fsFile(this._filePathAbs).exists()) {
      const dir = path.dirname(this._filePathAbs);
      const fileName = path.basename(this._filePathAbs);

      const pat = new RelativePattern(dir, fileName);
      const watcher = workspace.createFileSystemWatcher(pat);
      this._watchDisposable = Disposable.from(
        watcher,
        watcher.onDidChange(() => {
          this._loadCss();
          this._changedEmitter.fire();
        })
      );
    }
  }

  private _loadCss() {
    const f = fsFile(this._filePathAbs);
    this._content = f.exists() ? String(f.readAll()) : '';
  }
}

// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { workspace, Uri } from 'vscode';

const CurrentVersion = 1;

interface UriStoreFile<T> {
  version: number;
  entries: T[];
}

export class UriStore<T extends { uri: string }> {
  private _file: Uri | undefined;
  protected _entries: T[] = [];

  async init(storageUri: Uri, fileName: string) {
    if (!this._file) {
      this._file = Uri.joinPath(storageUri, 'doc-viewer', fileName);
      await this.load();
    }
  }

  public get entries() {
    return this._entries;
  }

  public contains(uri: string) {
    return this._findIndex(uri) !== -1;
  }

  public async load() {
    try {
      if (this._file) {
        const bytes = await workspace.fs.readFile(this._file);
        const file = JSON.parse(
          Buffer.from(bytes).toString('utf8')
        ) as UriStoreFile<T>;
        this._entries = file.version === CurrentVersion ? file.entries : [];
      }
    } catch {
      this._entries = [];
    }
  }

  public async save() {
    const file: UriStoreFile<T> = {
      version: CurrentVersion,
      entries: this._entries
    };

    if (this._file) {
      await workspace.fs.createDirectory(Uri.joinPath(this._file, '..'));
      await workspace.fs.writeFile(
        this._file,
        Buffer.from(JSON.stringify(file), 'utf8')
      );
    }
  }

  protected _findIndex(uri: string) {
    return this._entries.findIndex((e) => e.uri === uri);
  }

  protected _remove(selection: { uri: string }[]) {
    const uris = new Set(selection.map((e) => e.uri));
    this._entries = this._entries.filter((e) => !uris.has(e.uri));
    return true;
  }

  protected _clear() {
    this._entries = [];
    return true;
  }
}

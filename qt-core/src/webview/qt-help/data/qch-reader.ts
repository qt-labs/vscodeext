// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs';
import * as path from 'path';
import { Database, SqlJsStatic, ParamsObject } from 'sql.js';

import { IndexEntry, TocEntry } from '@/webview/shared/qt-help';
import { fetchSql } from './sql';

export class QchReader {
  private readonly _db: Database;

  private constructor(
    private readonly _sql: SqlJsStatic,
    private readonly _filePath: string
  ) {
    const data = fs.readFileSync(this._filePath);
    this._db = new this._sql.Database(data);
  }

  public static async create(sqlDistPath: string, qchPath: string) {
    return new QchReader(await fetchSql(sqlDistPath), qchPath);
  }

  public readToc() {
    const all: TocEntry[] = [];
    const statement = this._db.prepare(SqlQueries.readContentData);

    while (statement.step()) {
      const o = statement.getAsObject();
      all.push(...buildTocEntries(o));
    }

    statement.free();
    return all;
  }

  public readIndexes() {
    const all: IndexEntry[] = [];
    const statement = this._db.prepare(SqlQueries.readIndexes);

    while (statement.step()) {
      const o = statement.getAsObject();
      all.push(buildIndexEntry(o));
    }

    statement.free();
    return all;
  }
}

// helpers
function buildIndexEntry(o: ParamsObject): IndexEntry {
  return {
    title: String(o.FileTitle ?? ''),
    filePathRel: path.join(
      String(o.FolderName ?? ''),
      String(o.FileName ?? '')
    ),
    anchor: String(o.Anchor ?? ''),
    name: String(o.Name ?? '')
  } satisfies IndexEntry;
}

function buildTocEntries(o: ParamsObject): TocEntry[] {
  const all: TocEntry[] = [];
  const subFolder = String(o.FolderName ?? '');
  const reader = new BytesReader(o.Data as Uint8Array);

  while (reader.bytesAvailable()) {
    const depth = reader.readUint32();
    const fileName = reader.readString(reader.readUint32());
    const pageTitle = reader.readString(reader.readUint32());

    all.push({
      title: pageTitle,
      filePathRel: path.join(subFolder, fileName),
      depth
    } satisfies TocEntry);
  }

  return all;
}

class BytesReader {
  private _pos = 0;
  private readonly _view: DataView;

  constructor(private readonly _data: Uint8Array) {
    this._view = new DataView(_data.buffer, _data.byteOffset, _data.byteLength);
  }

  public bytesAvailable() {
    return this._pos < this._data.length;
  }

  public readUint32(): number {
    const i = this._view.getUint32(this._pos, false);
    this._pos += 4;

    return i;
  }

  public readString(length: number): string {
    const chars: string[] = [];

    for (let i = 0; i < length; i += 2) {
      const code = this._view.getUint16(this._pos + i, false);
      chars.push(String.fromCharCode(code));
    }

    this._pos += length;
    return chars.join('');
  }
}

const SqlQueries = {
  readIndexes: `
    SELECT
      IndexTable.Name,
      IndexTable.Anchor,
      FolderTable.Name as FolderName,
      FileNameTable.Name as FileName,
      FileNameTable.Title as FileTitle
    FROM
      IndexTable,
      FolderTable,
      FileNameTable
    WHERE
      IndexTable.FileId == FileNameTable.FileId
      AND FileNameTable.FolderId == FolderTable.Id
  `,

  readContentData: `
    SELECT
      ContentsTable.Data,
      FolderTable.Name as FolderName
    FROM
      ContentsTable,
      FolderTable
    WHERE
      ContentsTable.NamespaceID == FolderTable.NamespaceID
  `
};

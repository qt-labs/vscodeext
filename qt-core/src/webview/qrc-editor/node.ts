// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import _ from 'lodash';
import * as path from 'path';
import * as vscode from 'vscode';

import { EXTENSION_ID } from '@/constants';
import {
  RccTag,
  QResourceTag,
  isQResourceTag,
  FileTag,
  isFileTag,
  QrcNodePos
} from '@/webview/shared/qrc-types';
import { QrcDoc } from './doc';
import * as utils from './utils';

// Represents a single node in QRC data
export class QrcNode {
  public rcc: RccTag = { qresource: [], attributes: {} };
  public group: QResourceTag | undefined;
  public file: FileTag | undefined;
  public pos: QrcNodePos;

  public qrcDir = '';
  public qrcUri: vscode.Uri | undefined;
  public fileUri: vscode.Uri | undefined;

  constructor(
    public doc: QrcDoc,
    groupKey: string,
    fileIndex: number
  ) {
    this.pos = new QrcNodePos(groupKey, fileIndex);
    this._update(doc, this.pos);
  }

  public addGroup(prefix: string): QResourceTag {
    const group = {
      file: [],
      attributes: { prefix }
    } as QResourceTag;

    utils.updateGroupHashes(group);
    group.attributes.__groupKey = utils.generateKey();
    this.rcc.qresource.push(group);

    return group;
  }

  public addFiles(absFilePaths: string[]): number[] {
    if (!this.qrcUri || !this.group) {
      return [];
    }

    const existingPaths = this.group.file.map((f) => f.text);
    const added: FileTag[] = [];

    absFilePaths
      .filter((p) => p.startsWith(this.qrcDir))
      .forEach((p) => {
        const text = normalizeFilePath(this.qrcDir, p);
        if (!existingPaths.includes(text)) {
          added.push({
            text,
            attributes: {}
          });
        }
      });

    if (added.length !== 0) {
      const prevLength = this.group.file.length;
      this.group.file.push(...added);
      utils.updateGroupHashes(this.group);

      return _.range(prevLength, this.group.file.length);
    }

    return [];
  }

  public remove(): boolean {
    if (!this.group) {
      return false;
    }

    if (this.pos.fileIndex === -1) {
      const groupIndex = this._findGroupIndex();
      if (groupIndex >= 0) {
        this.rcc.qresource.splice(groupIndex, 1);
        return true;
      }
    } else {
      this.group.file.splice(this.pos.fileIndex, 1);
      return true;
    }

    return false;
  }

  public setAttribute(name: string, value: string): boolean {
    name = name.trim();
    value = value.trim();

    if (name === 'alias' && this.file) {
      this.file.attributes[name] = value;
      return true;
    }

    if ((name === 'prefix' || name === 'lang') && this.group) {
      this.group.attributes[name] = value;
      return true;
    }

    return false;
  }

  public async copy(): Promise<boolean> {
    const s = createJson(this.file ?? this.group);
    if (s.length === 0) {
      return false;
    }

    await vscode.env.clipboard.writeText(s);
    return true;
  }

  public async paste() {
    const text = await vscode.env.clipboard.readText();
    const data = parseClipData(text);
    if (!data) {
      return undefined;
    }

    return this._insertClipData(data);
  }

  // private methods
  private _findGroupIndex(): number {
    if (this.pos.groupKey.length === 0) {
      return -1;
    }

    return this.rcc.qresource.findIndex((g) => {
      return g.attributes.__groupKey === this.pos.groupKey;
    });
  }

  private _findGroupFromKey(groupKey: string): QResourceTag | undefined {
    return this.rcc.qresource.find((g) => {
      return g.attributes.__groupKey === groupKey;
    });
  }

  private _update(doc: QrcDoc, pos: QrcNodePos) {
    this.rcc = doc.rccTag ?? { qresource: [], attributes: {} };
    this.group = this._findGroupFromKey(pos.groupKey);
    this.file = this.group?.file[pos.fileIndex];

    this.qrcDir = path.dirname(doc.uri.fsPath);
    this.qrcUri = doc.uri;
    this.fileUri = this.file
      ? vscode.Uri.file(path.join(this.qrcDir, this.file.text))
      : undefined;
  }

  private _insertClipData(data: QrcClipData) {
    const type = data.header.type;
    const body = data.body;

    if (type === QrcClipTypeFile && this.group && isFileTag(body)) {
      utils.updateFileHash(body);
      const index = insertAfterOrPush(
        this.group.file,
        this.pos.fileIndex,
        body
      );

      return {
        groupKey: this.pos.groupKey,
        fileIndexes: [index]
      };
    }

    if (type === QrcClipTypeGroup && isQResourceTag(body)) {
      utils.resolvePrefixClash(body, this.rcc);
      utils.updateGroupHashes(body);
      utils.ensureGroupKey(body);
      insertAfterOrPush(this.rcc.qresource, this._findGroupIndex(), body);

      return {
        groupKey: body.attributes.__groupKey ?? '',
        fileIndexes: [-1, ..._.range(0, body.file.length)]
      };
    }

    return undefined;
  }
}

// helpers
function normalizeFilePath(qrcDir: string, absPath: string) {
  const rel = path.relative(qrcDir, absPath);
  return rel.replace(/\\/g, '/');
}

function insertAfterOrPush<T>(array: T[], index: number, item: T): number {
  // inserts after the given index or appends.
  // returns inserted index.
  if (index < 0 || index >= array.length) {
    array.push(item);
    return array.length - 1;
  }

  array.splice(index + 1, 0, item);
  return index + 1;
}

// helpers for copy/cut/paste
const QrcClipSource = `vscode.${EXTENSION_ID}`;
const QrcClipTypeFile = 'qrc.file';
const QrcClipTypeGroup = 'qrc.group';

interface QrcClipData {
  header: {
    source: typeof QrcClipSource;
    type: typeof QrcClipTypeFile | typeof QrcClipTypeGroup;
  };
  body: FileTag | QResourceTag;
}

function isQrcClipData(x: unknown): x is QrcClipData {
  if (
    typeof x !== 'object' ||
    x === null ||
    !('header' in x) ||
    !('body' in x)
  ) {
    return false;
  }

  // header
  const h = x.header;
  if (
    typeof h !== 'object' ||
    h === null ||
    !('source' in h) ||
    !('type' in h) ||
    h.source !== QrcClipSource ||
    (h.type !== QrcClipTypeFile && h.type !== QrcClipTypeGroup)
  ) {
    return false;
  }

  // body
  const b = x.body;
  if (typeof b !== 'object' || b === null) {
    return false;
  }

  return h.type === QrcClipTypeFile ? isFileTag(b) : isQResourceTag(b);
}

function createJson(tag: FileTag | QResourceTag | undefined): string {
  const type = isFileTag(tag)
    ? QrcClipTypeFile
    : isQResourceTag(tag)
      ? QrcClipTypeGroup
      : undefined;

  if (!type) {
    return '';
  }

  const body = _.cloneDeep(tag);
  utils.cleanTagDeep(body);

  return JSON.stringify({
    body,
    header: { source: QrcClipSource, type }
  });
}

function parseClipData(text: string): QrcClipData | undefined {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  try {
    const o: unknown = JSON.parse(trimmed);
    return isQrcClipData(o) ? o : undefined;
  } catch {
    return undefined;
  }
}

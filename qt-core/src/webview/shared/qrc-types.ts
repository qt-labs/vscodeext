// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { CommandId } from './message';

// types for xml serialization
export interface RccTag {
  qresource: QResourceTag[];
  attributes: Attributes;
}

export interface QResourceTag {
  file: FileTag[];
  attributes: Attributes;
}

export interface FileTag {
  text: string;
  attributes: Attributes;
}

export interface Attributes {
  version?: string; // <RCC>
  lang?: string; // <qresource>
  prefix?: string; // <qresource>
  alias?: string; // <file>
  empty?: string; // <file>

  // internal use
  __hash?: string;
  __groupKey?: string;
  __groupFilesHash?: string;

  // to preserve unknown attributes
  [key: string]: string;
}

export function isRccTag(x: unknown): x is RccTag {
  if (typeof x !== 'object' || x === null) {
    return false;
  }

  const o = x as Record<string, unknown>;
  if (!('qresource' in o)) {
    return false;
  }
  if (!Array.isArray(o.qresource)) {
    return false;
  }
  if (!o.qresource.every(isQResourceTag)) {
    return false;
  }

  return 'attributes' in o && isAttributes(o.attributes);
}

export function isQResourceTag(x: unknown): x is QResourceTag {
  if (typeof x !== 'object' || x === null) {
    return false;
  }

  const o = x as Record<string, unknown>;
  if (!('file' in o)) {
    return false;
  }
  if (!Array.isArray(o.file)) {
    return false;
  }
  if (!o.file.every(isFileTag)) {
    return false;
  }

  return 'attributes' in o && isAttributes(o.attributes);
}

export function isFileTag(x: unknown): x is FileTag {
  if (typeof x !== 'object' || x === null) {
    return false;
  }

  const o = x as Record<string, unknown>;
  if (!('text' in o) || typeof o.text !== 'string') {
    return false;
  }

  return 'attributes' in o && isAttributes(o.attributes);
}

export function isAttributes(x: unknown): x is Attributes {
  if (typeof x !== 'object' || x === null) {
    return false;
  }

  for (const v of Object.values(x)) {
    if (typeof v !== 'string') {
      return false;
    }
  }

  return true;
}

export type QrcCommandPayloadType =
  | QrcNodePosData
  | (QrcNodePosData & { files: string[] })
  | (QrcNodePosData & { action: string })
  | (QrcNodePosData & { thumbnailSize: number })
  | (QrcNodePosData & { name: string; value: string });

export type QrcCommandReplyType =
  | RccTag
  | { status: 'done' }
  | { exists: boolean; thumbnail?: number[] }
  | { action: 'add' | 'paste'; groupKey: string; fileIndexes: number[] };

export interface QrcDocChangeEvent {
  key: string;
  reason: 'command' | 'undo/redo' | 'not-specified';
  commandId?: CommandId;
}

export function isQrcDocChangeEvent(x: unknown): x is QrcDocChangeEvent {
  if (typeof x !== 'object' || x === null) {
    return false;
  }

  const o = x as Record<string, unknown>;
  if (!('key' in o) || typeof o.key !== 'string') {
    return false;
  }

  if (!('reason' in o) || typeof o.reason !== 'string') {
    return false;
  }

  if (
    o.reason !== 'command' &&
    o.reason !== 'undo/read' &&
    o.reason !== 'not-specified'
  ) {
    return false;
  }

  if ('commandId' in o && typeof o.commandId !== 'number') {
    return false;
  }

  return true;
}

// node position data and a wrapper class
interface QrcNodePosData {
  groupKey: string;
  fileIndex: number;
}

export class QrcNodePos implements QrcNodePosData {
  public groupKey = '';
  public fileIndex = -1;

  constructor(groupKey = '', fileIndex = -1) {
    this.setData(groupKey, fileIndex);
  }

  public equals(rhs: QrcNodePos): boolean {
    return this.groupKey === rhs.groupKey && this.fileIndex === rhs.fileIndex;
  }

  public isValid() {
    return this.groupKey.length !== 0;
  }

  public isGroup() {
    return this.groupKey.length !== 0 && this.fileIndex === -1;
  }

  public isFile() {
    return this.groupKey.length !== 0 && this.fileIndex !== -1;
  }

  public toJson() {
    return {
      groupKey: this.groupKey,
      fileIndex: this.fileIndex
    };
  }

  public toString(): string {
    return QrcNodePos._createId(this.groupKey, this.fileIndex);
  }

  public setData(groupKey: string, fileIndex: number): boolean {
    if (this.groupKey !== groupKey || this.fileIndex !== fileIndex) {
      this.groupKey = groupKey;
      this.fileIndex = fileIndex;
      return true;
    }

    return false;
  }

  public setDataFromId(id: string) {
    const n = QrcNodePos._parseId(id);
    if (n) {
      return this.setData(n.groupKey, n.fileIndex);
    }

    return false;
  }

  private static _createId(groupKey: string, fileIndex: number) {
    return `qrcnode|${groupKey}|${fileIndex}`;
  }

  private static _parseId(id: string) {
    const match = id.match(/^qrcnode\|(.+)\|(-?\d+)$/);
    if (match) {
      const groupKey = match[1];
      const file = Number(match[2]);
      return new QrcNodePos(groupKey, file);
    }

    return undefined;
  }
}

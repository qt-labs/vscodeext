// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

export interface DocRootInfo {
  source: 'insRoot' | 'qtpaths';
  version: string;
  fsPath: string;
}

export interface DocPageRef {
  title: string;
  filePathRel: string; // relative to DocRootInfo.fsPath
  anchor?: string; // without the leading '#'
}

export interface TocEntry extends DocPageRef {
  depth: number;
}

export interface IndexEntry extends DocPageRef {
  name: string;
}

export interface FullTextMatch extends DocPageRef {
  snippet: string;
}

export interface ParsedTitle {
  text: string;
  module?: string;
  version?: string;
}

// helpers
export function isSameDocPageRef(a: DocPageRef, b: DocPageRef) {
  return (
    a.filePathRel === b.filePathRel &&
    a.anchor === b.anchor &&
    a.title === b.title
  );
}

// type guard functions
export function isDocRootInfo(x: unknown): x is DocRootInfo {
  if (!isValidObject(x)) {
    return false;
  }

  return (
    (x.source === 'insRoot' || x.source === 'qtpaths') &&
    typeof x.version === 'string' &&
    typeof x.fsPath === 'string'
  );
}

export function isDocPageRef(x: unknown): x is DocPageRef {
  if (!isValidObject(x)) {
    return false;
  }

  return (
    typeof x.title === 'string' &&
    typeof x.filePathRel === 'string' &&
    (x.anchor === undefined || typeof x.anchor === 'string')
  );
}

export function isTocEntry(x: unknown): x is TocEntry {
  return isValidObject(x) && isDocPageRef(x) && typeof x.depth === 'number';
}

export function isIndexEntry(x: unknown): x is IndexEntry {
  return isValidObject(x) && isDocPageRef(x) && typeof x.name === 'string';
}

export function isFullTextMatch(x: unknown): x is FullTextMatch {
  return isValidObject(x) && isDocPageRef(x) && typeof x.snippet === 'string';
}

function isValidObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

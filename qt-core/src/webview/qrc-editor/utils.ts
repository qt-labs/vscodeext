// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { createHash } from 'crypto';

import {
  RccTag,
  QResourceTag,
  Attributes,
  isRccTag,
  isQResourceTag,
  isFileTag,
  FileTag
} from '@/webview/shared/qrc-types';

export function makeUniqueName(name: string, alreadyUsed: Set<string>): string {
  if (!alreadyUsed.has(name)) {
    return name;
  }

  const maxAttempts = 10_000; // arbitrary big number

  for (let c = 1; c < maxAttempts; ++c) {
    const modified = `${name}${c}`;
    if (!alreadyUsed.has(modified)) {
      return modified;
    }
  }

  return name;
}

export function updateFileHash(f: FileTag) {
  const raw = [f.text, f.attributes.alias ?? '', f.attributes.empty ?? ''].join(
    '|'
  );

  f.attributes.__hash = hashString(raw);
}

export function updateGroupHashes(g: QResourceTag) {
  const raw = [g.attributes.prefix ?? '', g.attributes.lang ?? ''].join('|');

  g.attributes.__hash = hashString(raw);

  g.file.forEach((f) => {
    updateFileHash(f);
  });
  g.attributes.__groupFilesHash = hashString(
    g.file.map((f) => f.attributes.__hash).join('|')
  );
}

export function resolvePrefixClash(group: QResourceTag, rcc: RccTag) {
  let prefix = group.attributes.prefix ?? '';
  prefix = prefix.length === 0 ? '/' : prefix;
  prefix = makeUniqueName(
    prefix,
    new Set(rcc.qresource.map((g) => g.attributes.prefix ?? ''))
  );

  group.attributes.prefix = prefix;
}

export function ensureGroupKey(group: QResourceTag) {
  group.attributes.__groupKey ??= generateKey();
}

export function generateKey() {
  return crypto.randomUUID();
}

export function cleanTagDeep(tag: unknown) {
  if (isRccTag(tag)) {
    tag.attributes = cleanAttributes(tag.attributes);
    tag.qresource.forEach((g) => {
      cleanTagDeep(g);
    });
  } else if (isQResourceTag(tag)) {
    tag.attributes = cleanAttributes(tag.attributes);
    tag.file.forEach((f) => {
      cleanTagDeep(f);
    });
  } else if (isFileTag(tag)) {
    tag.attributes = cleanAttributes(tag.attributes);
  }
}

// helpers
function cleanAttributes(attrs: Attributes): Attributes {
  // Removes unwanted attributes:
  // 1) Attributes with an empty string value (e.g., alias='', lang='', ...)
  // 2) Internal attributes prefixed with '__'
  const result: Attributes = {};

  for (const [key, value] of Object.entries(attrs)) {
    if (value !== '' && !key.startsWith('__')) {
      result[key] = value;
    }
  }

  return result;
}

function hashString(input: string, length = 12): string {
  return createHash('md5').update(input).digest('hex').slice(0, length);
}

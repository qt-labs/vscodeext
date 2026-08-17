// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs';
import { createHash } from 'crypto';

// SHA256 of a file as a lowercase hex string, computed by streaming so large
// downloads are not loaded into memory at once.
export async function sha256OfFile(filePath: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk as Buffer));
    stream.on('end', () => {
      resolve(hash.digest('hex'));
    });
    stream.on('error', reject);
  });
}

// Compare a manifest-supplied digest against an actual SHA256 hex string.
// The expected value may be prefixed ("sha256:<hex>") or bare hex. Returns
// false for any missing, malformed, or non-matching input so callers can fail
// closed.
export function digestMatches(
  expected: string | undefined,
  actualHex: string
): boolean {
  if (!expected) {
    return false;
  }
  const want = expected
    .replace(/^sha256:/i, '')
    .trim()
    .toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(want)) {
    return false;
  }
  return want === actualHex.trim().toLowerCase();
}

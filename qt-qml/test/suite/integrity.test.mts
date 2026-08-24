// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createHash } from 'crypto';

import { digestMatches, sha256OfFile } from '@/integrity.js';

const sha256 = (data: string) =>
  createHash('sha256').update(Buffer.from(data)).digest('hex');

describe('Download integrity (R3)', () => {
  it('accepts a matching sha256:-prefixed digest', () => {
    const hex = sha256('hello');
    expect(digestMatches(`sha256:${hex}`, hex)).to.equal(true);
  });

  it('accepts a bare-hex digest case-insensitively', () => {
    const hex = sha256('hello');
    expect(digestMatches(hex.toUpperCase(), hex)).to.equal(true);
  });

  it('rejects a mismatched digest', () => {
    expect(
      digestMatches(`sha256:${sha256('hello')}`, sha256('hell0'))
    ).to.equal(false);
  });

  it('fails closed on missing or malformed digests', () => {
    const hex = sha256('x');
    expect(digestMatches(undefined, hex)).to.equal(false);
    expect(digestMatches('', hex)).to.equal(false);
    expect(digestMatches('sha256:not-hex', hex)).to.equal(false);
    expect(digestMatches('sha256:abc', hex)).to.equal(false); // too short
  });

  it('sha256OfFile matches the file contents hash', async () => {
    const content = 'the quick brown fox';
    const p = path.join(os.tmpdir(), `qmlls-integrity-${process.pid}.bin`);
    fs.writeFileSync(p, Buffer.from(content));
    try {
      expect(await sha256OfFile(p)).to.equal(sha256(content));
    } finally {
      fs.rmSync(p, { force: true });
    }
  });
});

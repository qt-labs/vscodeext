// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { assertInside } from 'qt-lib';

suite('Archive extraction containment (R4)', () => {
  let root: string;
  let outside: string;

  setup(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'extract-root-'));
    outside = fs.mkdtempSync(path.join(os.tmpdir(), 'outside-'));
  });

  teardown(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  });

  test('allows a not-yet-existing path inside the root', () => {
    expect(() =>
      assertInside(root, path.join(root, 'sub/file.txt'))
    ).to.not.throw();
  });

  test('rejects an absolute path outside the root', () => {
    expect(() => assertInside(root, path.join(outside, 'x'))).to.throw();
  });

  test('rejects .. traversal out of the root', () => {
    expect(() => assertInside(root, path.join(root, '../escape'))).to.throw();
  });

  test('rejects a write through a planted symlink that escapes the root', () => {
    // The PL-002 primitive: a symlink inside the root pointing outside, then a
    // write through it. Realpath sees through the link; a lexical check would not.
    fs.symlinkSync(outside, path.join(root, 'evil'));
    expect(() =>
      assertInside(root, path.join(root, 'evil', 'payload.plist'))
    ).to.throw();
  });

  test('rejects a symlink target that resolves outside the root', () => {
    const linkPath = path.join(root, 'link');
    const resolvedTarget = path.resolve(
      path.dirname(linkPath),
      '../../../../etc'
    );
    expect(() => assertInside(root, resolvedTarget)).to.throw();
  });

  test('allows a symlink target that stays inside the root', () => {
    const linkPath = path.join(root, 'link');
    const resolvedTarget = path.resolve(path.dirname(linkPath), 'sub/inside');
    expect(() => assertInside(root, resolvedTarget)).to.not.throw();
  });
});

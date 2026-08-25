// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { assertInside, isInside, isInsideReal } from 'qt-lib';

function trySymlink(target: string, linkPath: string) {
  try {
    fs.symlinkSync(target, linkPath);
    return true;
  } catch {
    return false;
  }
}

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

  test('rejects a write through a planted symlink that escapes the root', function () {
    // The PL-002 primitive: a symlink inside the root pointing outside, then a
    // write through it. Realpath sees through the link; a lexical check would not.
    if (!trySymlink(outside, path.join(root, 'evil'))) {
      this.skip();
    }
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

suite('Path containment helpers (R7)', () => {
  let root: string;
  let outside: string;

  setup(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'contain-root-'));
    outside = fs.mkdtempSync(path.join(os.tmpdir(), 'contain-outside-'));
  });

  teardown(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  });

  test('isInside rejects a sibling directory sharing the root prefix', () => {
    expect(isInside('/opt/vcpkg', '/opt/vcpkg-evil/x')).to.equal(false);
    expect(isInside('/opt/vcpkg', '/opt/vcpkg/installed')).to.equal(true);
  });

  test('isInside accepts the root itself', () => {
    expect(isInside('/opt/vcpkg', '/opt/vcpkg')).to.equal(true);
  });

  test('isInside rejects .. traversal and absolute escapes', () => {
    expect(isInside('/opt/vcpkg', '/opt/vcpkg/a/../../etc')).to.equal(false);
    expect(isInside('/opt/vcpkg', '/etc/passwd')).to.equal(false);
  });

  test('isInside resolves a relative candidate against the root', () => {
    expect(isInside('/opt/vcpkg', 'sub/file')).to.equal(true);
    expect(isInside('/opt/vcpkg', '../other')).to.equal(false);
  });

  test('isInside works without the root existing on disk', () => {
    const missing = path.join(root, 'missing-root');
    expect(isInside(missing, path.join(missing, 'a'))).to.equal(true);
  });

  test('isInsideReal fails closed when the root is missing', () => {
    const missing = path.join(root, 'missing-root');
    expect(isInsideReal(missing, path.join(missing, 'a'))).to.equal(false);
  });

  test('isInsideReal sees through an escaping leaf symlink', function () {
    const secret = path.join(outside, 'secret');
    fs.writeFileSync(secret, '');
    if (!trySymlink(secret, path.join(root, 'link'))) {
      this.skip();
    }
    expect(isInsideReal(root, path.join(root, 'link'))).to.equal(false);
  });

  test('isInsideReal allows a not-yet-existing path inside the root', () => {
    expect(isInsideReal(root, path.join(root, 'new/file'))).to.equal(true);
  });
});

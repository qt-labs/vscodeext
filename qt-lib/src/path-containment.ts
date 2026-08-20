// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs';
import * as path from 'path';

/**
 * Throw if `candidate` would escape `root` once the symlinks in its existing
 * prefix are resolved, and otherwise return the resolved absolute path.
 *
 * `candidate` need not exist yet: an archive entry is validated before it is
 * written, so the check realpaths the deepest ancestor that does exist. That
 * defeats a symlink planted earlier in the same extraction which would redirect
 * a later write outside `root`, as well as `..` traversal and absolute paths. A
 * lexical `startsWith` check cannot see through such symlinks; realpath can.
 *
 * `root` must already exist on disk.
 */
export function assertInside(root: string, candidate: string): string {
  const realRoot = fs.realpathSync(root);
  const target = path.resolve(realRoot, candidate);

  let existing = target;
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) {
      break;
    }
    existing = parent;
  }
  const realExisting = fs.realpathSync(existing);

  const rel = path.relative(realRoot, realExisting);
  if (isEscapingRelation(rel)) {
    throw new Error(`Refusing path outside ${root}: ${candidate}`);
  }
  return target;
}

/**
 * Lexical containment check: true if `candidate` stays under `root` after
 * path resolution, without touching the filesystem. A relative `candidate`
 * is resolved against `root`, matching `assertInside`.
 *
 * Symlinks are NOT resolved, so this must not guard a filesystem read or
 * write on its own; use `assertInside`/`isInsideReal` at such sinks. It is
 * the right check when the root may not exist on disk, and unlike a bare
 * `startsWith` it cannot be fooled by sibling prefixes (`/opt/vcpkg` vs
 * `/opt/vcpkg-evil`).
 */
export function isInside(root: string, candidate: string): boolean {
  const resolvedRoot = path.resolve(root);
  const rel = path.relative(
    resolvedRoot,
    path.resolve(resolvedRoot, candidate)
  );
  return !isEscapingRelation(rel);
}

/**
 * Boolean form of `assertInside`: true if `candidate` stays under `root`
 * once symlinks in its existing prefix are resolved. Also returns false
 * when `root` itself does not exist.
 */
export function isInsideReal(root: string, candidate: string): boolean {
  try {
    assertInside(root, candidate);
    return true;
  } catch {
    return false;
  }
}

function isEscapingRelation(rel: string): boolean {
  return (
    rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)
  );
}

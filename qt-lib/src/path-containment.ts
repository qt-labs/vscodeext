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
  if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    throw new Error(`Refusing path outside the extraction root: ${candidate}`);
  }
  return target;
}

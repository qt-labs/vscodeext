// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { CoreKey, QtAdditionalPath } from 'qt-lib';
import { coreAPI, projectManager } from '@/extension';
import { QtpathsWrapper, QtInsRootWrapper } from './wrappers';

export type FinderScope = 'global' | 'projects' | 'all';

export function findQtInsRoots(scope: FinderScope) {
  const candidates = makeUnique(
    readCoreValues(CoreKey.QT_INSTALLATION_ROOT, scope).filter(
      (e) => typeof e === 'string'
    )
  );

  return candidates
    .map((e) => new QtInsRootWrapper(e))
    .filter((w) => w.isValid());
}

export async function findQtKitPaths(scope: FinderScope) {
  // findQtKits()'s return values will be like <insRoot>/<qt-version>/<arch>
  // for example,
  // - /.../Qt/6.10.0/macos
  // - /.../Qt/6.10.0/android_x86

  const all = await Promise.all(
    findQtInsRoots(scope).map(async (qtInsRoot) => qtInsRoot.getKits())
  );

  return all.flat();
}

export function findAdditionalQtpaths(scope: FinderScope) {
  const candidates = makeUnique(
    readCoreValues<QtAdditionalPath[]>(CoreKey.ADDITIONAL_QT_PATHS, scope)
      .filter((e) => e !== undefined)
      .flat()
  );

  return candidates
    .map((e) => new QtpathsWrapper(e.path))
    .filter((w) => w.isValid());
}

function makeUnique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function readCoreValues<T>(key: string, scope: FinderScope) {
  const found: (T | undefined)[] = [];

  if (scope === 'global' || scope === 'all') {
    found.push(coreAPI?.getValue<T>(CoreKey.GLOBAL_WORKSPACE, key));
  }

  if (scope === 'projects' || scope === 'all') {
    projectManager.getProjects().forEach((project) => {
      found.push(coreAPI?.getValue<T>(project.folder, key));
    });
  }

  return found;
}

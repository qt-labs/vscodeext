// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';

import { createLogger, compareVersions } from 'qt-lib';
import {
  ExEntry,
  ExPackage,
  ExCategory,
  ExPackagePoolDir,
  ExResolvedPaths
} from '@/webview/shared/ex-browser';
import { fsDir, fsFile } from '@/fs-utils';
import * as consts from './constants';
import * as catHelpers from './helpers-category';
import * as searchHelpers from './helpers-search';
import { ExPathsResolver } from './resolvers';
import { parseManifestFile, ManifestType } from './manifest-parser';

const logger = createLogger('examples-data-manager');

export class ExDataManager {
  private _packages: ExPackage[] = [];
  private _categories: ExCategory[] = [];

  private _examples: ExEntry[] = [];
  private _resolvedPaths: Record<string, ExResolvedPaths> = {};

  public constructor(sources: ExPackagePoolDir[]) {
    this._loadPackages(sources);
  }

  public dispose() {
    this._packages = [];
    this._categories = [];
    this._examples = [];
    this._resolvedPaths = {};
  }

  get packages() {
    return this._packages;
  }

  get categories() {
    return this._categories;
  }

  get examples() {
    return this._examples;
  }

  get resolvedPaths() {
    return this._resolvedPaths;
  }

  public selectPackage(p: ExPackage) {
    logger.info(`Selecting examples: ${p.poolDir.fsPath}, ${p.subDir}`);

    this._examples = [];
    this._resolvedPaths = {};

    const categoriesCollector = new catHelpers.CategoriesCollector();
    const manifests = discoverManifestFiles(
      path.join(p.poolDir.fsPath, consts.DOCS_DIR_NAME, p.subDir)
    );

    const resolver = new ExPathsResolver(p.poolDir.fsPath, p.subDir);

    manifests.forEach((m) => {
      const files = parseManifestFile(m.absPath, m.type);

      files.forEach((e: ExEntry) => {
        const resolved = resolver.resolve(e);
        const check = checkDataIntegrity(e, resolved);
        if (check.length !== 0) {
          logger.info(`Example name: '${e.name}', status: ${check}`);
        }

        if (isValidExample(resolved)) {
          categoriesCollector.collectFrom(e);
          this._examples.push(e);
          this._resolvedPaths[e.projectPath] = resolved;
        }
      });
    });

    this._categories = categoriesCollector.finalize();
    searchHelpers.sortByCategories(this._examples);

    return true;
  }

  public search(category: ExCategory, query: string) {
    const a = searchHelpers.filterByCategory(this._examples, category);
    const b = searchHelpers.filterByQuery(a, query);
    return searchHelpers.sortHighlightedFirst(b);
  }

  private _loadPackages(locs: ExPackagePoolDir[]) {
    this._packages.length = 0;

    locs.forEach((loc) => {
      this._packages.push(...readPackagesInfo(loc));
    });
  }
}

function isValidExample(p: ExResolvedPaths) {
  return (
    p.projectFile.endsWith('CMakeLists.txt') && fsFile(p.projectFile).exists()
  );
}

function checkDataIntegrity(e: ExEntry, p: ExResolvedPaths) {
  const tokens = [
    p.doc.length === 0 ? 'no-doc' : '',
    p.image.length === 0 ? 'no-image' : '',
    p.projectDir.length === 0 ? 'no-projectDir' : ''
  ];

  if (p.projectFile.length === 0) {
    tokens.push('no-projectFile');
  } else if (!p.projectFile.endsWith('CMakeLists.txt')) {
    tokens.push(`not-cmakeproject (${p.projectFile})`);
  }

  if (e.filesToOpen.length !== Object.keys(p.filesToOpen).length) {
    tokens.push(
      [
        'missing-filesToOpen (',
        `need: ${String(e.filesToOpen.length)}, `,
        `valid: ${String(Object.keys(p.filesToOpen).length)}`,
        ')'
      ].join('')
    );
  }

  return tokens.filter((t) => t.length !== 0).join(', ');
}

export function discoverManifestFiles(absPath: string) {
  const dir = fsDir(absPath);
  const allDemos = dir.allFilePaths(consts.DEMO_MANIFEST_FILE_NAME);
  const allExamples = dir.allFilePaths(consts.EX_MANIFEST_FILE_NAME);

  return [
    ...allDemos.map((p) => ({ absPath: p, type: 'demo' as ManifestType })),
    ...allExamples.map((p) => ({ absPath: p, type: 'example' as ManifestType }))
  ];
}

export function readPackagesInfo(poolDir: ExPackagePoolDir): ExPackage[] {
  try {
    const all = fsDir(poolDir.fsPath, consts.DOCS_DIR_NAME).subDirNames();
    const prefixLength = 'Qt-'.length;
    const regexQt6 = new RegExp(`^Qt-6\\.\\d+\\.\\d+$`);

    return all
      .filter((s) => regexQt6.test(s))
      .sort((a, b) => {
        return (
          -1 *
          compareVersions(a.substring(prefixLength), b.substring(prefixLength))
        );
      })
      .map((dir) => {
        return {
          name: dir,
          subDir: dir,
          poolDir
        } as ExPackage;
      });
  } catch (_e) {
    return [];
  }
}

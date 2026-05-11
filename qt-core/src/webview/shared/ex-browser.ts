// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

// example
export interface ExEntry {
  name: string;
  module: string;
  description: string;
  docUrl: string;
  imageUrl: string;
  highlighted: boolean;
  projectPath: string;
  filesToOpen: string[];
  tags: string[];
  categories: string[];
}

export function isExEntry(x: unknown): x is ExEntry {
  if (typeof x !== 'object' || x === null) {
    return false;
  }

  const o = x as Record<string, unknown>;
  return (
    typeof o.name === 'string' &&
    typeof o.module === 'string' &&
    typeof o.description === 'string' &&
    typeof o.docUrl === 'string' &&
    typeof o.imageUrl === 'string' &&
    typeof o.highlighted === 'boolean' &&
    typeof o.projectPath === 'string' &&
    Array.isArray(o.filesToOpen) &&
    o.filesToOpen.every((f) => typeof f === 'string') &&
    Array.isArray(o.tags) &&
    o.tags.every((t) => typeof t === 'string') &&
    Array.isArray(o.categories) &&
    o.categories.every((c) => typeof c === 'string')
  );
}

export interface ExResolvedPaths {
  doc: string;
  image: string;
  projectDir: string;
  projectFile: string;
  filesToOpen: Record<string, string>; // relative to absolute path
}

export function isExResolvedPaths(x: unknown): x is ExResolvedPaths {
  if (typeof x !== 'object' || x === null) {
    return false;
  }

  const o = x as Record<string, unknown>;
  return (
    typeof o.doc === 'string' &&
    typeof o.image === 'string' &&
    typeof o.projectDir === 'string' &&
    typeof o.projectFile === 'string' &&
    typeof o.filesToOpen === 'object' &&
    o.filesToOpen !== null &&
    Object.values(o.filesToOpen).every((f) => typeof f === 'string')
  );
}

export function isExResolvedPathsRecord(
  x: unknown
): x is Record<string, ExResolvedPaths> {
  return (
    typeof x === 'object' &&
    x !== null &&
    Object.values(x).every(isExResolvedPaths)
  );
}

// package
export type ExPackageSourceType = 'insRoot' | 'qtpaths';

export interface ExPackagePoolDir {
  fsPath: string;
  sourceType: ExPackageSourceType;
  docsPath?: string;
  examplesPath?: string;
  qtVersion?: string;
}

export function isExPackagePoolDir(x: unknown): x is ExPackagePoolDir {
  if (typeof x !== 'object' || x === null) {
    return false;
  }

  const o = x as Record<string, unknown>;
  return (
    typeof o.fsPath === 'string' &&
    typeof o.sourceType === 'string' &&
    (o.sourceType === 'insRoot' || o.sourceType === 'qtpaths') &&
    (o.docsPath === undefined || typeof o.docsPath === 'string') &&
    (o.examplesPath === undefined || typeof o.examplesPath === 'string') &&
    (o.qtVersion === undefined || typeof o.qtVersion === 'string')
  );
}

export interface ExPackage {
  name: string;
  subDir: string;
  poolDir: ExPackagePoolDir;
}

export function isExPackage(x: unknown): x is ExPackage {
  if (typeof x !== 'object' || x === null) {
    return false;
  }

  const o = x as Record<string, unknown>;
  return (
    typeof o.name === 'string' &&
    typeof o.subDir === 'string' &&
    isExPackagePoolDir(o.poolDir)
  );
}

// category
export type ExCategoryType = 'general' | 'all' | 'featured';

export function isExCategoryType(x: unknown): x is ExCategoryType {
  return x === 'general' || x === 'all' || x === 'featured';
}

export interface ExCategory {
  type: ExCategoryType;
  name: string;
  tags: string[];
  count: number;
}

export function isExCategory(x: unknown): x is ExCategory {
  if (typeof x !== 'object' || x === null) {
    return false;
  }

  const o = x as Record<string, unknown>;
  return (
    typeof o.type === 'string' &&
    isExCategoryType(o.type) &&
    typeof o.name === 'string' &&
    Array.isArray(o.tags) &&
    o.tags.every((t) => typeof t === 'string') &&
    typeof o.count === 'number'
  );
}

export function isExCategoryArray(x: unknown): x is ExCategory[] {
  return Array.isArray(x) && x.every(isExCategory);
}

// others
export interface ExNewProjectArgs {
  name: string;
  workingDir: string;
  saveProjectDir: boolean;
  openIn: 'addToWorkspace' | 'newWindow';
}

export function isExNewProjectArgs(x: unknown): x is ExNewProjectArgs {
  if (typeof x !== 'object' || x === null) {
    return false;
  }

  const o = x as Record<string, unknown>;
  return (
    typeof o.name === 'string' &&
    typeof o.workingDir === 'string' &&
    typeof o.saveProjectDir === 'boolean' &&
    typeof o.openIn === 'string' &&
    (o.openIn === 'addToWorkspace' || o.openIn === 'newWindow')
  );
}

export interface ExBrowserViewConfig {
  newProject: ExNewProjectArgs;
}

export function isExBrowserViewConfig(x: unknown): x is ExBrowserViewConfig {
  if (typeof x !== 'object' || x === null) {
    return false;
  }

  const o = x as Record<string, unknown>;
  return isExNewProjectArgs(o.newProject);
}

export type ExActionTypes =
  | 'file-open'
  | 'project-open'
  | 'project-open-file'
  | 'project-reveal'
  | 'project-create'
  | 'doc-open-internal'
  | 'doc-open-external';

export const TagPrefix = '#';

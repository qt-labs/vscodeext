// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

// catalog
export interface Catalog {
  courses: CourseRawData[];
  learningPaths: CourseRawData[];
}

export function isCatalog(x: unknown): x is Catalog {
  if (typeof x !== 'object' || x === null) {
    return false;
  }

  const o = x as Record<string, unknown>;
  return (
    Array.isArray(o.courses) &&
    o.courses.every(isCourseRawData) &&
    Array.isArray(o.learningPaths) &&
    o.learningPaths.every(isCourseRawData)
  );
}

// course
export type CourseType = 'course' | 'learningpath';
export type CourseLevel = 'basic' | 'intermediate' | 'advanced';

export function isCourseType(x: unknown): x is CourseType {
  return typeof x === 'string' && (x === 'course' || x === 'learningpath');
}

export function isCourseLevel(x: unknown): x is CourseLevel {
  return (
    typeof x === 'string' &&
    (x === 'basic' || x === 'intermediate' || x === 'advanced')
  );
}

export interface CourseRawData {
  id: number;
  name: string;
  [key: string]: unknown;
}

export interface CourseData extends CourseRawData {
  type: CourseType;
}

function isCourseRawData(x: unknown): x is CourseRawData {
  if (typeof x !== 'object' || x === null) {
    return false;
  }

  const o = x as Record<string, unknown>;
  return typeof o.id === 'number' && typeof o.name === 'string';
}

export function isCourseData(x: unknown): x is CourseData {
  if (typeof x !== 'object' || x === null) {
    return false;
  }

  const o = x as Record<string, unknown>;
  return isCourseRawData(x) && isCourseType(o.type);
}

export function isCourseDataArray(x: unknown): x is CourseData[] {
  return Array.isArray(x) && x.every(isCourseData);
}

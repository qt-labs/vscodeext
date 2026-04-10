// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { isArray } from 'lodash';

// extension information
export interface ExtInfo {
  id: string;
  name: string;
  version: string;

  active: boolean;
  preRelease: boolean;
}

export function isExtInfo(x: unknown): x is ExtInfo {
  if (typeof x !== 'object' || x === null) {
    return false;
  }

  const o = x as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    typeof o.version === 'string' &&
    typeof o.active === 'boolean' &&
    typeof o.preRelease === 'boolean'
  );
}

export function isExtInfoArray(x: unknown): x is ExtInfo[] {
  return isArray(x) && x.every(isExtInfo);
}

// blog article
export interface BlogArticle {
  title: string;
  link: string;
  author: string;
  thumbnail: string;
  description: string;
  publishedDate: string;
}

export function isBlogArticle(x: unknown): x is BlogArticle {
  if (typeof x !== 'object' || x === null) {
    return false;
  }

  const o = x as Record<string, unknown>;
  return (
    typeof o.title === 'string' &&
    typeof o.link === 'string' &&
    typeof o.author === 'string' &&
    typeof o.thumbnail === 'string' &&
    typeof o.description === 'string' &&
    typeof o.publishedDate === 'string'
  );
}

export function isBlogArticleArray(x: unknown): x is BlogArticle[] {
  return isArray(x) && x.every(isBlogArticle);
}

// video
export interface VideoEntry {
  title: string;
  link: string;
  thumbnail: string;
  description: string;
  publishedDate: string;
}

export function isVideoEntry(x: unknown): x is VideoEntry {
  if (typeof x !== 'object' || x === null) {
    return false;
  }

  const o = x as Record<string, unknown>;
  return (
    typeof o.title === 'string' &&
    typeof o.link === 'string' &&
    typeof o.thumbnail === 'string' &&
    typeof o.description === 'string' &&
    typeof o.publishedDate === 'string'
  );
}

export function isVideoEntryArray(x: unknown): x is VideoEntry[] {
  return isArray(x) && x.every(isVideoEntry);
}

// others
export type RssSource = 'blog' | 'video';
export type DataType = 'ext-info' | RssSource;

export type ActionId =
  | 'openUrl'
  | 'openWebsite'
  | 'openWebview'
  | 'openMarketplace'
  | 'refresh-data';

export type WebsiteId =
  | 'qt-docs'
  | 'qt-blogs'
  | 'qt-download'
  | 'qt-youtube-channel'
  | 'qtforpython-doc'
  | 'bug-report'
  | 'documentation';

export type WebviewId = 'new-project' | 'examples' | 'courses';

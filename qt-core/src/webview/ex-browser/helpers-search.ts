// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { TagPrefix, ExEntry, ExCategory } from '@/webview/shared/ex-browser';
import * as catHelpers from './helpers-category';

export function filterByCategory(source: ExEntry[], category: ExCategory) {
  const predicate = (entry: ExEntry): boolean => {
    if (category.type === 'all') {
      return true;
    }

    const nameLC = category.name.trim().toLowerCase();
    if (nameLC.length === 0) {
      return false;
    }

    return entry.categories.some((c) => {
      return c.toLowerCase() === nameLC;
    });
  };

  return source.filter(predicate);
}

export function filterByQuery(source: ExEntry[], q: string) {
  const tagExps: RegExp[] = [];
  const keywordExps: RegExp[] = [];

  q.split(' ').forEach((t) => {
    const s = t.trim().toLowerCase();
    if (s.length === 0) {
      return;
    }

    if (!s.startsWith(TagPrefix)) {
      keywordExps.push(new RegExp(s, 'i'));
    } else {
      if (s.length >= 2) {
        tagExps.push(new RegExp(`^${s.substring(1)}$`, 'i'));
      }
    }
  });

  const matchesAllTags = (entry: ExEntry): boolean =>
    tagExps.length === 0 ||
    tagExps.every((re) => entry.tags.some((t) => re.test(t)));

  const matchesAllKeywords = (entry: ExEntry): boolean =>
    keywordExps.length === 0 ||
    keywordExps.every((re) => re.test(entry.name)) ||
    keywordExps.every((re) => re.test(entry.description)) ||
    keywordExps.every((re) => re.test(entry.tags.join(' ')));

  return source.filter((e) => {
    return matchesAllTags(e) && matchesAllKeywords(e);
  });
}

export function sortByCategories(examples: ExEntry[]) {
  return examples.sort((a, b) => {
    const sa = catHelpers.getCategoryScore(a);
    const sb = catHelpers.getCategoryScore(b);
    return sa != sb ? sb - sa : a.name.localeCompare(b.name);
  });
}

export function sortHighlightedFirst(entries: ExEntry[]) {
  return entries.sort((a, b) => {
    return a.highlighted !== b.highlighted ? (a.highlighted ? -1 : 1) : 0;
  });
}

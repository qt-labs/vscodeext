// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import _ from 'lodash';

import {
  ExEntry,
  ExCategory,
  ExCategoryType
} from '@/webview/shared/ex-browser';
import { exBrowser as texts } from '@/texts';
import * as consts from './constants';

const categoryScores: Map<string, number> = createCategoryScores();

export class CategoriesCollector {
  private readonly _all: CategoryBuilder;
  private readonly _general = new Map<string, CategoryBuilder>();

  public constructor() {
    this._all = new CategoryBuilder(texts.specialCategory.all, 'all');
  }

  public collectFrom(example: ExEntry) {
    this._all.reflect(example);

    example.categories.forEach((c) => {
      const collector = this._findGeneralCategoryBuilder(c);
      if (collector) {
        collector.reflect(example);
      }
    });
  }

  public finalize(): ExCategory[] {
    const generals = Array.from(this._general.values()).map((builder) =>
      builder.build()
    );

    return [this._all.build(), ...sortCategories(generals)];
  }

  private _findGeneralCategoryBuilder(name: string) {
    if (!this._general.has(name)) {
      this._general.set(name, new CategoryBuilder(name, 'general'));
    }

    return this._general.get(name);
  }
}

class CategoryBuilder {
  private _count = 0;
  private readonly _tagCounts = new Map<string, number>();

  public constructor(
    private readonly _name: string,
    private readonly _type: ExCategoryType
  ) {}

  public reflect(example: ExEntry) {
    if (this._isRelevant(example)) {
      this._count += 1;

      example.tags.forEach((t) => {
        const candidate = t.trim();
        if (candidate) {
          this._tagCounts.set(
            candidate,
            (this._tagCounts.get(candidate) ?? 0) + 1
          );
        }
      });
    }
  }

  public build(): ExCategory {
    const tags = _.sortBy(Array.from(this._tagCounts.keys()));
    const tagCounts = Object.fromEntries(this._tagCounts);

    return {
      type: this._type,
      name: this._name,
      tags,
      count: this._count,
      tagCounts
    };
  }

  private _isRelevant(example: ExEntry) {
    return this._type === 'all' || example.categories.includes(this._name);
  }
}

export function getCategoryScore(e: ExEntry): number {
  let max = 0;
  e.categories.forEach((cat) => {
    max = Math.max(max, categoryScores.get(cat.toLowerCase()) ?? 0);
  });

  return max;
}

function sortCategories(categories: ExCategory[]): ExCategory[] {
  const scored = categories.map((c: ExCategory) => {
    return {
      score: categoryScores.get(c.name.toLowerCase()) ?? 0,
      category: c
    };
  });

  scored.sort((a, b) => {
    return a.score !== b.score
      ? b.score - a.score
      : a.category.name.localeCompare(b.category.name);
  });

  return scored.map((e) => e.category);
}

function createCategoryScores(): Map<string, number> {
  const list = [
    // this is from the qtc source (examplelistmodel.cpp) and tweeked.
    // the first entry will get the highest score.
    consts.DEMO_INJECTED_CATEGORY_NAME,
    'Application Examples',
    'Desktop',
    'Mobile',
    'Embedded',
    'Graphics & Multimedia',
    'Graphics',
    'Multimedia',
    'Data Visualization & 3D',
    'Data Visualization',
    '3D',
    'Data Processing & I/O',
    'Data Processing',
    'Input/Output',
    'Connectivity',
    'Networking',
    'Positioning & Location',
    'Positioning',
    'Location',
    'Web Technologies',
    'Web',
    'Internationalization'
  ];

  return new Map(
    list.map((name, index) => [name.toLocaleLowerCase(), list.length - index])
  );
}

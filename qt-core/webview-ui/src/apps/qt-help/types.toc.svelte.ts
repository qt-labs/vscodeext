// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { type TocEntry } from "@shared/qt-help";

export interface TocTreeViewNode {
  id: number;
  data: TocEntry;
  children: TocTreeViewNode[];
}

export class TocTreeViewModel {
  private _topLevels = $state([] as TocTreeViewNode[]);
  private _expandedIds = $state(new Set<number>());
  private _expandableIds: number[] = [];

  get topLevels() {
    return this._topLevels;
  }

  get expandedState(): 'empty' | 'partial' | 'full' {
    if (this._expandedIds.size === 0) {
      return 'empty';
    }

    return (this._expandableIds.length === this._expandedIds.size)
      ? 'full' : 'partial';
  }

  public expanded(id: number) {
    return this._expandedIds.has(id);
  }

  public toggleExpanded(id: number) {
    this.setExpanded(id, !this.expanded(id));
  }

  public setExpanded(id: number, expand: boolean) {
    if (this._expandedIds.has(id) === expand) {
      return;
    }

    const newSet = new Set(this._expandedIds);
    if (expand) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }

    this._expandedIds = newSet;
  }

  public setExpandedAll(expand: boolean) {
    if (expand) {
      if (this._expandedIds.size === 0 && this._expandableIds.length !== 0) {
        this._expandedIds = new Set(this._expandableIds);
      }
      return;
    }

    if (this._expandedIds.size !== 0) {
      this._expandedIds = new Set();
    }
  }

  public collapseAll() {
    if (this._expandedIds.size !== 0) {
      this._expandedIds = new Set();
    }
  }

  public rebuild(all: TocEntry[]) {
    const { topLevels, expandableIds } = buildTopLevelEntries(all);

    this._topLevels = topLevels;
    this._expandableIds = expandableIds;
    this._expandedIds = new Set<number>();
  }
}

// helpers
function buildTopLevelEntries(all: TocEntry[]) {
  const stack: TocTreeViewNode[] = [];
  const expandableIds: number[] = [];
  const topLevels: TocTreeViewNode[] = [];

  all.forEach((entry, i) => {
    const node: TocTreeViewNode = {
      id: i,
      data: entry,
      children: []
    };

    while (stack.length > entry.depth) {
      stack.pop();
    }

    const parent = stack[entry.depth - 1];
    if (!parent) {
      topLevels.push(node);
    } else {
      if (parent.children.length === 0) {
        expandableIds.push(parent.id);
      }

      parent.children.push(node);
    }

    stack[entry.depth] = node;
  });

  return { topLevels, expandableIds };
}

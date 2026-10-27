// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import {
  type HistoryEntry,
  type BookmarkEntry
} from "@shared/doc-viewer";
import { docBrowser as texts } from '@/apps/texts';

interface CheckableItem<T> {
  data: T;
  checked: boolean;
}

export type BookmarkItem = CheckableItem<BookmarkEntry>;
export type HistoryItem = CheckableItem<HistoryEntry>;
export type HistoryItemGroup = {
  label: string;
  items: HistoryItem[];
};

// check states
export type CheckState = 'empty' | 'partial' | 'all';

export function createCheckState(items: () => { checked: boolean }[]) {
  const allItems = items();
  const checkedItems = allItems.filter((e) => e.checked);

  const total = $derived(allItems.length);
  const checked = $derived(checkedItems.length);
  const state = $derived.by<CheckState>(() => {
    return (checked === 0)
      ? 'empty'
      : checked === total ? 'all' : 'partial';
  });

  const description = $derived.by(() => {
    return texts.selectedItems(checked, total);
  });

  return {
    get state() { return state; },
    get total() { return total; },
    get description() { return description }
  };
}

// find in page
export type FindAction = 'new' | 'prev' | 'next' | 'clear';

// history
export class HistoryManager {
  private _history = $state([] as HistoryEntry[]);
  private _currentIndex = $state(-1);

  public get currentEntry() {
    return this._history[this._currentIndex];
  }

  public canGo(dir: 'back' | 'forward') {
    if (dir === 'back') {
      return this._currentIndex > 0;
    }

    return this._currentIndex + 1 < this._history.length;
  }


  public go(dir: 'back' | 'forward') {
    if (dir === 'back') {
      if (this._currentIndex > 0) {
        this._currentIndex--;
        return this.currentEntry;
      }
    }

    if (dir === 'forward') {
      if (this._currentIndex + 1 < this._history.length) {
        this._currentIndex++;
        return this.currentEntry;
      }
    }

    return undefined;
  }

  public push(entry: HistoryEntry) {
    if ((entry.uri.length === 0)
      || (this.currentEntry && (entry.uri === this.currentEntry.uri))) {
      return;
    }

    this._history = [
      ...this._history.slice(0, this._currentIndex + 1),
      entry
    ];

    this._currentIndex = this._history.length - 1;
  }

  public pushUrl(url: URL) {
    this.push({
      uri: url.href,
      title: '',
    });
  }
}

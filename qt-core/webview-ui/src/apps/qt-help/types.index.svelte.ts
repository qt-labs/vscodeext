// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import VirtualList from "svelte-tiny-virtual-list";
import { type AfterScrollDetail } from "svelte-tiny-virtual-list";

import {
  type IndexEntry,
  type ParsedTitle,
  isSameDocPageRef
 } from "@shared/qt-help";

export const IndexListItemHeight = 24;

export interface IndexListSectionInfo {
  letter_uc: string;
  startIndex: number;
  startItem: IndexListViewItem;
};

export type IndexListViewItemType =
  | 'item'
  | 'group-header' | 'grouped-item'
  | 'section-header';

export interface IndexListViewItem {
  type: IndexListViewItemType;
  name: string;
  display: string;
  data: IndexEntry;
  annotation: string;
}

export class IndexListViewModel {
  private _sortedData: IndexEntry[] = [];
  private _filteredData: IndexEntry[] = [];

  private _items = $state<IndexListViewItem[]>([]);
  private _sections = $state<IndexListSectionInfo[]>([]);
  private _viewState = new IndexListViewState(this);

  public get items() {
    return this._items;
  }

  public get length() {
    return this._items.length;
  }

  public get sections() {
    return this._sections;
  }

  public get viewState() {
    return this._viewState;
  }

  public reset(raw: IndexEntry[]) {
    this._sortedData = sort(raw);
  }

  public invalidate(keyword: string) {
    this._filteredData = filterByKeyword(this._sortedData, keyword);

    this._items = buildGroupedItemList(this._filteredData);
    this._sections = buildSectionInfo(this._items);
    this._viewState.reset();
  }
}

// helpers
class IndexListViewState {
  private _currentIndexAtTop = $state(-1);
  private _scrollTargetPosition = $state(0);

  constructor(private readonly _model: IndexListViewModel) {}

  public get currentSection() {
    const letter_uc = this.currentSectionLetter;
    return letter_uc
      ? this._findSectionByLetter(letter_uc)
      : undefined;
  }

  public get currentSectionLetter() {
    const item = this._model.items[this._currentIndexAtTop];
    return item?.name.charAt(0).toUpperCase();
  }

  public get scrollTargetPosition() {
    return this._scrollTargetPosition;
  }

  public scrollListToSection(list: VirtualList, letter_uc: string) {
    const match = this._findSectionByLetter(letter_uc);
    if (!match || match.startIndex < 0) {
      return false;
    }

    if (this._currentIndexAtTop !== match.startIndex) {
      this._currentIndexAtTop = match.startIndex;
      this._scrollTargetPosition = match.startIndex * IndexListItemHeight;
      return true;
    }

    return false;
  }

  public reset() {
    const empty = this._model.items.length == 0;
    this._currentIndexAtTop = empty ? -1 : 0;
  }

  public onScrolled = (e: AfterScrollDetail) => {
    const i = Math.floor(e.offset / IndexListItemHeight);
    this._currentIndexAtTop  = Math.min(i, this._model.length - 1);
  }

  private _findSectionByLetter(letter_uc: string) {
    return this._model.sections.find((s: IndexListSectionInfo) => {
      return s.letter_uc === letter_uc;
    });
  }
}


// helper
function sort(raw: IndexEntry[]) {
  const getScore = (s: string) => {
    const c = s[0] ?? '';
    if (/[a-z]/i.test(c)) {
      return 0
    };

    if (/[0-9]/.test(c)) {
      return 1;
    }

    return 2;
  };

  const sorted = [...raw].sort((a, b) => {
    const diff = getScore(a.name) - getScore(b.name);
    return diff || a.name.localeCompare(b.name);
  });

  // remove duplicated entries
  return sorted.filter((e, i) => {
    const prev = sorted[i - 1];
    return !prev || prev.name !== e.name || !isSameDocPageRef(prev, e);
  });
}

function filterByKeyword(source: IndexEntry[], keyword: string) {
  const k = keyword.trim();
  if (k.length === 0) {
    return source;
  }

  const keyword_lc = k.toLowerCase();
  return source.filter((v) => {
    return (v.name.toLowerCase().indexOf(keyword_lc) !== -1);
  });
}

function buildGroupedItemList(raw: IndexEntry[]) {
  const all: IndexListViewItem[] = [];

  function add(type: IndexListViewItemType, data: IndexEntry) {
    const parsedTitle = parseTitle(data.title);
    const display = (type === 'section-header')
      ? data.name.charAt(0).toUpperCase()
      : (type !== 'grouped-item') ? data.name : parsedTitle.text;

    all.push({
      type,
      name: data.name,
      display,
      data,
      annotation: parsedTitle.module ?? '',
    } satisfies IndexListViewItem);
  }

  for (let i = 0; i < raw.length; ++i) {
    const data = raw[i];
    const samePrev = raw[i - 1]?.name === data.name;
    const sameNext = raw[i + 1]?.name === data.name;
    const newGroup = !samePrev && sameNext;

    const prevSection = all.at(-1)?.name.charAt(0).toUpperCase();
    const currentSection = data.name.charAt(0).toUpperCase();
    const newSection = prevSection !== currentSection;

    if (newSection) {
      add('section-header', data);
    }

    if (newGroup) {
      add('group-header', data);
    }

    add((!samePrev && !sameNext) ? 'item' : 'grouped-item', data);
  }

  return all;
}

function buildSectionInfo(items: IndexListViewItem[]) {
  return items.reduce<IndexListSectionInfo[]>(
    (all, item, index) => {
      const letter = item.name.charAt(0).toUpperCase();
      if (letter && letter !== all.at(-1)?.letter_uc) {
        all.push({
          letter_uc: letter,
          startIndex: index,
          startItem: item
        });
      }

      return all;
  }, []);
}

const QT_VERSION_RE = /^Qt\s+(\d+(?:\.\d+)*)$/;
const QT_MODULE_VERSION_RE = /^(Qt\s+.+?)\s+(\d+(?:\.\d+)+)$/;

function parseTitle(s: string): ParsedTitle {
  const parts = s.split('|').map((p) => p.trim());
  const [text = '', second, third] = parts;

  // 3-parts: title | module | Qt x.y.z
  if (parts.length >= 3) {
    return {
      text,
      module: second,
      version: QT_VERSION_RE.exec(third)?.[1] ?? third
    };
  }

  // 2-parts: title | "Qt Core 6.8.8"  ->  module + version
  //          title | "Qt Widgets Designer Manual" -> module only
  if (parts.length === 2) {
    const m = QT_MODULE_VERSION_RE.exec(second);
    return m
      ? { text, module: m[1], version: m[2] }
      : { text, module: second };
  }

  // 1-part
  return { text };
}

// const QT_MODULE_RE = /^Qt\s+\S/;
// const QT_VERSION_RE = /^Qt\s+(\d+(?:\.\d+)*)$/;

// function parseTitle(s: string): ParsedTitle {
//   const [first = '', ...rest] = s
//     .split('|')
//     .map((p) => p.trim());

//   const titleParts = [first];
//   let module: string | undefined;
//   let version: string | undefined;

//   for (const p of rest) {
//     const v = QT_VERSION_RE.exec(p);
//     if (v && !version) {
//       version = v[1];
//     } else if (!module && QT_MODULE_RE.test(p)) {
//       module = p;
//     } else {
//       titleParts.push(p);
//     }
//   }

//   return {
//     text: titleParts.join(' | '),
//     module,
//     version
//   };
// };

// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import _ from 'lodash';
import { vscode } from '@/apps/vscode';
import {
  isBookmarkEntry,
  type BookmarkEdit,
  type BookmarkEntry,
} from '@shared/doc-viewer';

import { CommandId } from '@shared/message';
import { data } from './states.svelte';
import { type BookmarkItem } from './types.svelte';

export async function load() {
  const r = await vscode.post(CommandId.DocViewerGetBookmarks);
  setBookmarks(_.get(r, 'entries', [] as BookmarkEntry[]));
}

export async function edit(edit: BookmarkEdit) {
  const r = await vscode.post(CommandId.DocViewerEditBookmarks, { edit });
  setBookmarks(_.get(r, 'entries', [] as BookmarkEntry[]));
}

export function getSelection() {
  return data.bookmarks
    .filter((e) => e.checked)
    .map(e => e.data);
}

export function setAllChecked(checked: boolean) {
  data.bookmarks.forEach((e) => {
    e.checked = checked;
  });
}

export function has(uri: string) {
  return data.bookmarks.some((e) => e.data.uri === uri);
}

function setBookmarks(entries: BookmarkEntry[]) {
  if (Array.isArray(entries) && entries.every(isBookmarkEntry)) {
    data.bookmarks = entries.map((e) => {
      return {
        data: e,
        checked: false
      } as BookmarkItem
    });
  }
}


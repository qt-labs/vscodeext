// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import _ from 'lodash';
import { vscode } from '@/apps/vscode';
import { type HistoryItem } from './types.svelte';

import {
  isHistoryEntry,
  type HistoryEdit,
  type HistoryEntry,
} from '@shared/doc-viewer';
import { CommandId } from '@shared/message';
import { data } from './states.svelte';

export async function load() {
  const r = await vscode.post(CommandId.DocViewerGetHistories);
  setHistories(_.get(r, 'entries', [] as HistoryEntry[]));
}

export async function edit(edit: HistoryEdit) {
  const r = await vscode.post(CommandId.DocViewerEditHistories, { edit });
  setHistories(_.get(r, 'entries', [] as HistoryEntry[]));
}

export function getSelection() {
  return data.history.raw
    .filter((e) => e.checked)
    .map(e => e.data);
}

export function setAllChecked(checked: boolean) {
  data.history.raw.forEach((e) => {
    e.checked = checked;
  });
}

function setHistories(entries: HistoryEntry[]) {
  if (!Array.isArray(entries) || !entries.every(isHistoryEntry)) {
    return;
  }

  const raw = entries.map((e) => {
    return {
      data: e,
      checked: false
    } as HistoryItem
  });

  data.history.raw = raw;
  data.history.groups = createHistoryGroups(data.history.raw);
}

// helpers
function createHistoryGroups(raw: HistoryItem[]) {
  const map = new Map<string, { label: string; items: HistoryItem[] }>();

  for (const item of raw.toReversed()) {
    const date = new Date(item.data.timestamp ?? 0);
    const key = date.toDateString();
    let group = map.get(key);
    if (!group) {
      group = {
        items: [],
        label: date.toLocaleDateString(undefined, { dateStyle: 'full' }),
      };

      map.set(key, group);
    }

    group.items.push(item);
  }

  return [...map.values()];
}
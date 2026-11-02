// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import _ from 'lodash';

import { vscode } from '@/apps/vscode';
import { CommandId } from '@shared/message';
import {
  isTocEntry,
  isIndexEntry,
  isSearchResultEntry,
  isDocRootInfo,
  type DocPageRef,
  type DocRootInfo,
} from '@shared/qt-help';
import * as docViewer from '../doc-viewer/viewlogic.svelte';
import { data, ui } from './states.svelte';
import { type UiMode, type UiTaskName } from './types.svelte';

export async function onAppMount() {
  await loadAllDocRoots();

  if (data.docs.length !== 0) {
    selectDoc(data.docs[0]);
  }
}

export async function onAppDestroy() {
}

export async function loadAllDocRoots() {
  const r = await vscode.post(CommandId.QtHelpGetDocRoots);

  if (Array.isArray(r) && r.every(isDocRootInfo)) {
    data.docs = r;
  }
}

export async function selectDoc(doc: DocRootInfo) {
  if (ui.selectedDoc === doc) {
    return;
  }

  const task = async () => {
    const r = await vscode.post(CommandId.QtHelpSelectDocRoot, {
      doc: $state.snapshot(doc)
    });

    ui.selectedDoc = doc;

    // reset data and ui
    data.toc = [];
    data.index = [];
    data.search.result = [];
    data.search.searchedKeyword = '';

    ui.search.keyword = '';
    ui.search.selected = undefined;

    // reload content
    await loadToc();
    await loadIndexes();

    // redirect to home
    const home = _.get(r, 'homeUri', '');
    if (home) {
      docViewer.openDoc(home);
    } else {
      docViewer.reset();
    }
  };

  await runTask(task, 'select-doc');
}

export async function revealDocRootFolder(doc: DocRootInfo) {
  await vscode.post(CommandId.QtHelpRevealDocRootFolder, {
    doc: $state.snapshot(doc)
  });
}

export async function loadToc() {
  const r = await vscode.post(CommandId.QtHelpReadToc);

  if (Array.isArray(r) && r.every(isTocEntry)) {
    data.toc = r;
    ui.toc.model.rebuild(r);
    ui.toc.selected = undefined;
  }
}

export async function loadIndexes() {
  const r = await vscode.post(CommandId.QtHelpReadIndexes);
  if (!Array.isArray(r) || !r.every(isIndexEntry)) {
    return;
  }

  data.index = r;
  ui.index.filter = '';
  ui.index.selected = undefined;
  ui.index.model.reset(r);
  ui.index.model.invalidate(ui.index.filter);
}

export function invalidateIndexModel() {
  ui.index.model.invalidate(ui.index.filter);
}

export async function search(keyword: string) {
  keyword = keyword.trim();

  if (keyword.length === 0) {
    data.search.result = [];
    data.search.searchedKeyword = '';
    return;
  }

  const task = async () => {
    const r = await vscode.post(CommandId.QtHelpSearchFullText, { keyword });
    const result = _.get(r, 'result', []);

    if (Array.isArray(result) && result.every(isSearchResultEntry)) {
      data.search.result = result;
      data.search.searchedKeyword = String(_.get(r, 'keyword', keyword)).trim();
    }
  }

  await runTask(task, 'search');
}

export async function jumpIndexToSection(letter: string) {
  const list = ui.index.viewComp;
  const state = ui.index.viewState;
  if (!list) {
    return;
  }

  const changed = state.scrollListToSection(list, letter.toUpperCase());
  const entry = state.currentSection?.startItem.data;
  if (changed && entry) {
    openHtml(entry);
  }
}

export function setMode(mode: UiMode) {
  ui.mode = mode;
}

export async function openHtml(r: DocPageRef) {
  const uri = toFileUri(r);
  if (uri) {
    docViewer.openDoc(uri.toString());
  }
}

export function isCurrentDoc(r: DocPageRef) {
  try {
    const uri = toFileUri(r);
    const currentUri = new URL(docViewer.currentUri());
    if (!uri || (uri.pathname !== currentUri.pathname)) {
      return false;
    }

    return uri.hash === currentUri.hash;
  } catch (e) {
    void e;
    return false;
  }
}

// helpers
function toFileUri(r: DocPageRef) {
  if (!ui.selectedDoc) {
    return undefined;
  }

  const url = new URL('file://');
  url.pathname = `${ui.selectedDoc.fsPath}/${r.filePathRel}`;
  url.hash = r.anchor ?? '';

  return url;
}

async function runTask(task: () => Promise<void> | void, name: UiTaskName) {
  await ui.task.run(task, {
    name,
    debounceTime_ms: (name === 'select-doc' ? 0 : 50),
  });
}

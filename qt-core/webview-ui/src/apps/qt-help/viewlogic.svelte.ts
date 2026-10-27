// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import _ from 'lodash';

import { vscode } from '@/apps/vscode';
import { CommandId } from '@shared/message';
import {
  isTocEntry,
  isIndexEntry,
  isFullTextMatch,
  isDocRootInfo,
  type DocPageRef,
  type DocRootInfo,
} from '@shared/qt-help';
import * as docViewer from '../doc-viewer/viewlogic.svelte';
import { data, ui } from './states.svelte';
import { type UiMode, type UiTaskName } from './types.svelte';

export async function onAppMount() {
  await loadPackages();

  if (data.packages.length !== 0) {
    selectPackage(data.packages[0]);
  }
}

export async function onAppDestroy() {
}

export async function loadPackages() {
  const r = await vscode.post(CommandId.QtHelpGetPackages);

  if (Array.isArray(r) && r.every(isDocRootInfo)) {
    data.packages = r;
  }
}

export async function selectPackage(p: DocRootInfo) {
  if (ui.selected.package === p) {
    return;
  }

  const task = async () => {
    const r = await vscode.post(CommandId.QtHelpSelectPackage, {
      package: $state.snapshot(p)
    });

    ui.selected.package = p;

    // reset data and ui
    data.toc = [];
    data.indexes = [];
    data.search.result = [];
    data.search.searchedKeyword = '';
    ui.search.keyword = '';

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

  await runTask(task, 'select-package');
}

export async function revealPackageFolder(p: DocRootInfo) {
  await vscode.post(CommandId.QtHelpRevealPackageFolder, {
    package: $state.snapshot(p)
  });
}

export async function loadToc() {
  const r = await vscode.post(CommandId.QtHelpReadToc);

  if (Array.isArray(r) && r.every(isTocEntry)) {
    data.toc = r;
    ui.tocModel.rebuild(r);
  }
}

export async function loadIndexes() {
  const r = await vscode.post(CommandId.QtHelpReadIndexes);
  if (!Array.isArray(r) || !r.every(isIndexEntry)) {
    return;
  }

  data.indexes = r;
  ui.index.model.reset(r);
  ui.index.model.invalidate(ui.index.filter.keyword);
}

export function invalidateIndexModel() {
  ui.index.model.invalidate(ui.index.filter.keyword);
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

    if (Array.isArray(result) && result.every(isFullTextMatch)) {
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
  if (!ui.selected.package) {
    return undefined;
  }

  const url = new URL('file://');
  url.pathname = `${ui.selected.package.fsPath}/${r.filePathRel}`;
  url.hash = r.anchor ?? '';

  return url;
}

async function runTask(task: () => Promise<void> | void, name: UiTaskName) {
  await ui.task.run(task, {
    name,
    debounceTime_ms: (name === 'select-package' ? 0 : 50),
  });
}

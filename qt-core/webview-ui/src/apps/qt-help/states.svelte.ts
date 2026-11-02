// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import VirtualList from 'svelte-tiny-virtual-list';

import {
  type TocEntry,
  type IndexEntry,
  type SearchResultEntry,
  type DocRootInfo,
} from '@shared/qt-help';
import { TaskBusyRunner } from '@/comps/TaskBusyRunner.svelte';
import { createPopoverController } from '@/comps/Popover.logic.svelte';
import * as VscodeThemeMonitor from '@/comps/VscodeThemeMonitor.svelte';
import {
  type UiMode,
  TocTreeViewModel,
  IndexListViewModel
} from './types.svelte';

export const data = $state({
  docs: [] as DocRootInfo[],
  toc: [] as TocEntry[],
  index: [] as IndexEntry[],
  search: {
    result: [] as SearchResultEntry[],
    searchedKeyword: ''
  }
});

export const ui = $state({
  task: new TaskBusyRunner(),
  theme: VscodeThemeMonitor.createController(),
  selectedDoc: undefined as DocRootInfo | undefined,

  toc: {
    model: new TocTreeViewModel(),
    selected: undefined as TocEntry | undefined
  },

  index: {
    filter: '',
    model: new IndexListViewModel(),
    selected: undefined as IndexEntry | undefined,
    viewComp: undefined as VirtualList | undefined,
    get viewState() { return this.model.viewState; }
  },

  search: {
    keyword: '',
    selected: undefined as SearchResultEntry | undefined
  },

  mode: 'toc' as UiMode,
  sidebar: {
    width: 350,
    min: 200,
    max: 600
  },

  popovers: {
    qtVersions: createPopoverController(),
    indexSelector: createPopoverController()
  }
});

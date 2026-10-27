// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import VirtualList from 'svelte-tiny-virtual-list';

import {
  type TocEntry,
  type IndexEntry,
  type FullTextMatch,
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
  packages: [] as DocRootInfo[],
  toc: [] as TocEntry[],
  indexes: [] as IndexEntry[],
  search: {
    result: [] as FullTextMatch[],
    searchedKeyword: ''
  }
});

export const ui = $state({
  task: new TaskBusyRunner(),
  theme: VscodeThemeMonitor.createController(),

  selected: {
    package: undefined as DocRootInfo | undefined,
  },

  sidebar: {
    width: 350,
    min: 200,
    max: 600
  },

  search: {
    keyword: ''
  },

  mode: 'toc' as UiMode,
  tocModel: new TocTreeViewModel(),

  index: {
    filter: { keyword: '' },
    model: new IndexListViewModel(),
    viewComp: undefined as VirtualList | undefined,
    get viewState() { return this.model.viewState; }
  },

  popovers: {
    qtVersions: createPopoverController(),
    indexSelector: createPopoverController()
  }
});

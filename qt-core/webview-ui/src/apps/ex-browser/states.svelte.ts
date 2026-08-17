// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import {
  type ExEntry,
  type ExPackage,
  type ExCategory,
  type ExResolvedPaths
} from '@shared/ex-browser';

import * as NewItemForm from '@/comps/NewItemForm.logic.svelte';
import * as VscodeThemeMonitor from '@/comps/VscodeThemeMonitor.svelte';

export type ViewMode = 'grid' | 'list';

export const data = $state({
  packages: [] as ExPackage[],
  examples: [] as ExEntry[],
  categories: [] as ExCategory[],
  resolvedPaths: {} as Record<string, ExResolvedPaths>
});

export const ui = $state({
  grid: undefined as HTMLDivElement | undefined,
  list: undefined as HTMLDivElement | undefined,
  theme: VscodeThemeMonitor.createController(),

  selected: {
    example: undefined as ExEntry | undefined,
    package: undefined as ExPackage | undefined,
    viewMode: 'grid' as ViewMode
  },

  filter: {
    tags: [] as string[],
    tagsFilterInput: '',
    searchInput: '',
    searchInputEl: undefined as HTMLInputElement | undefined,
    category: undefined as ExCategory | undefined
  },

  sidebar: {
    visible: false,
    newProject: {
      expanded: false,
      input: NewItemForm.createController(),
    },
  },

  popovers: {
    catalog: {
      visible: false,
      reference: undefined as HTMLElement | undefined
    },
    tags: {
      visible: false,
      reference: undefined as HTMLElement | undefined
    }
  },

  imageUrlCache: new Map<string, string>()
});

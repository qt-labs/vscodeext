// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import {
  type ExEntry,
  type ExPackage,
  type ExCategory,
  type ExResolvedPaths
} from "@shared/ex-browser";

import * as NewItemForm from '@/comps/NewItemForm.logic.svelte';
import * as VscodeThemeMonitor from '@/comps/VscodeThemeMonitor.svelte';

export type OverlayName = 'catalog' | 'details' | 'tagCloud';

export const data = $state({
  packages: [] as ExPackage[],
  examples: [] as ExEntry[],
  categories: [] as ExCategory[],
  resolvedPaths: {} as Record<string, ExResolvedPaths>
});

export const ui = $state({
  grid: undefined as HTMLDivElement | undefined,
  theme: VscodeThemeMonitor.createController(),

  selected: {
    example: undefined as ExEntry | undefined,
    package: undefined as ExPackage | undefined
  },

  filter: {
    query: '',
    category: undefined as ExCategory | undefined,
  },

  overlays: {
    catalog: {
      visible: false
    },

    details: {
      visible: false,
      collapsed: false,
      alignLeft: false,
      expanded: false,
    },

    tagCloud: {
      visible: false,
      position: '',
      refRect: undefined as (DOMRect | undefined),
    }
  },

  input: NewItemForm.createController(),
  imageUrlCache: new Map<string, string>(),
})

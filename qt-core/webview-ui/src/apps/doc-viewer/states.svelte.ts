// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as VscodeThemeMonitor from '@/comps/VscodeThemeMonitor.svelte';
import { createPopoverController } from '@/comps/Popover.logic.svelte';
import {
  NavigationStack,
  type HistoryItemGroup,
  type HistoryItem,
  type BookmarkItem,
} from './types.svelte';

export const data = $state({
  bookmarks: [] as BookmarkItem[],
  history: {
    raw: [] as HistoryItem[],
    groups: [] as HistoryItemGroup[]
  },
  configs: {
    homeUri: '',
    serverOrigin: '' // expects 'http://127.0.0.1:<port>'
  }
});

export const ui = $state({
  theme: VscodeThemeMonitor.createController(),
  navigation: new NavigationStack(),

  iframe: {
    el: undefined as HTMLIFrameElement | undefined,
    uri: '', // http://127.0.0.1:<port>/.../...html#anchor

    // state
    title: '',
    errorCode: '',
    scrollTop: 0,
    hoveredUri: '',
  },

  sidebar: {
    min: 200,
    max: 600,
    width: 350,
    mode: undefined as 'bookmark' | 'history' | undefined
  },

  popovers: {
    find: createPopoverController({ keyword: '' }),
    navigation: createPopoverController(),
    contextMenu: createPopoverController({
      pos: { x: 0, y: 0 },
      hoveredUri: '',
      hasSelection: false
    })
  }
});

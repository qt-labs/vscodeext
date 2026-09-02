// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { OpenInDefault } from '@shared/types';
import * as NewItemForm from '@/comps/NewItemForm.logic.svelte';
import { type Preset, PresetWrapper } from './types.svelte';

export const data = $state({
  serverReady: false,
  configs: {
    newFileBaseDir: '',
    newProjectBaseDir: '',
    openIn: OpenInDefault
  },
  presets: [] as Preset[],
  selected: {
    type: 'project',
    preset: new PresetWrapper(),
    presetIndex: -1
  }
});

export const input = NewItemForm.createController();

export const ui = $state({
  loading: {
    busy: false,
    error: undefined as unknown,
    forceHidden: false,
    delayedTimerId: null as (ReturnType<typeof setTimeout>) | null
  },

  activeDialog: undefined as 'create' | 'rename' | 'delete' | undefined,

  unsavedOptionChanges: {} as Record<string, unknown>
});

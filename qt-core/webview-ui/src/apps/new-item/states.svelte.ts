// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { type Preset, InputIssue, PresetWrapper } from './types.svelte';

export const data = $state({
  serverReady: false,
  configs: {
    newFileBaseDir: '',
    newProjectBaseDir: ''
  },
  presets: [] as Preset[],
  selected: {
    type: 'project',
    preset: new PresetWrapper(),
    presetIndex: -1
  }
});

export const input = $state({
  name: 'untitled',
  workingDir: '',
  saveProjectDir: false,

  issues: {
    name: new InputIssue(),
    workingDir: new InputIssue()
  }
});

export const ui = $state({
  loading: {
    busy: false,
    error: undefined as unknown,
    forceHidden: false,
    delayedTimerId: null as NodeJS.Timeout | null
  },

  activeDialog: undefined as 'create' | 'rename' | 'delete' | undefined,

  canCreate: true,
  unsavedOptionChanges: {} as Record<string, unknown>
});

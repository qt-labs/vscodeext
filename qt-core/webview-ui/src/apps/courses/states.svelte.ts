// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { type CourseType, type CourseLevel } from '@shared/courses';
import GridFlow from '@/comps/GridFlow.svelte';
import { TaskBusyRunner } from '@/comps/TaskBusyRunner.svelte';

import { type SortBy, type Course } from './types.svelte';

export const data = $state({
  raw: [] as Course[],
  refined: [] as Course[], // final data to render
});

export const ui = $state({
  task: new TaskBusyRunner(),
  grid: undefined as GridFlow | undefined,

  selected: {
    course: undefined as Course | undefined,
    sortBy: 'name' as SortBy
  },

  filter: {
    query: '',
    type: undefined as (CourseType | undefined),
    level: undefined as (CourseLevel | undefined)
  },

  overlays: {
    filter: {
      visible: false,
    },

    details: {
      visible: false,
      alignLeft: false,
      collapsed: false
    }
  }
})

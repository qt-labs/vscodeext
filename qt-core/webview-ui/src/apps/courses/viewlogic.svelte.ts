// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { vscode } from '@/apps/vscode';
import { CommandId } from '@shared/message';
import {
  type CourseType,
  type CourseLevel,
  isCourseDataArray,
} from '@shared/courses';

import {
  Course,
  type SortBy,
  type ActionTypes,
} from './types.svelte';
import { data, ui } from './states.svelte';

export async function onAppMount() {
  await loadCourses();
}

export async function selectCourse(c: Course | undefined) {
  ui.selected.course = c;
  ui.overlays.details.visible = (c !== undefined);
  ui.overlays.details.collapsed = false;
}

export async function setSort(sortBy: SortBy) {
  if (ui.selected.sortBy !== sortBy) {
    ui.selected.sortBy = sortBy;
    refineDataAndResetGridView();
  }
}

export async function setFilter(type?: CourseType, level?: CourseLevel) {
  if ((ui.filter.type !== type) || (ui.filter.level !== level)) {
    ui.filter.type = type;
    ui.filter.level = level;
    refineDataAndResetGridView();
  }
}

export async function setQuery(q: string) {
  const v = q.trim();

  if (ui.filter.query !== v) {
    ui.filter.query = v;
    refineDataAndResetGridView();
  }
}

export async function runAction(action: ActionTypes, args: object = {}) {
  await vscode.post(CommandId.CoursesRunAction, {
    action,
    course: {
      id: ui.selected.course?.id ?? -1,
      type: ui.selected.course?.type ?? '',
    },
    args
  });
}

async function loadCourses() {
  const task = async () => {
    const r = await vscode.post(CommandId.CoursesGetCourses);

    if (isCourseDataArray(r)) {
      data.raw = r.map((c) => new Course(c));
      ui.filter.type = undefined;
      ui.filter.level = undefined;
      refineDataAndResetGridView();
    }
  };

  await ui.task.run(task, { debounceTime_ms: 0 })
}

// helpers
async function refineDataAndResetGridView() {
  const filtered = filterData(data.raw, ui.filter);
  const sorted = sortData(filtered, ui.selected.sortBy);

  data.refined = sorted;

  if (ui.grid) {
    ui.grid.scrollToTop();
  }

  if (ui.selected.course && !data.refined.includes(ui.selected.course)) {
    ui.selected.course = undefined;
    ui.overlays.details.visible = false;
  }
}

function filterData(raw: Course[], filter: typeof ui.filter) {
  const tokens = filter.query
    .toLocaleLowerCase()
    .split(' ')
    .map((e) => e.trim())
    .filter((e) => e.length !== 0);

  return raw.filter((c) => {
    if ((filter.type !== undefined) && (c.type !== filter.type)) {
      return false;
    }

    if ((filter.level !== undefined) && (c.level !== filter.level)) {
      return false;
    }

    return (tokens.length === 0)
      ? true
      : (tokens.every((t) => c.searchTarget.includes(t)));
  });
}

type SortKeyFinder = (c: Course) => number | string;

function sortData(raw: Course[], sortBy: SortBy) {
  if (raw.length === 0) {
    return [];
  }

  const keyFinder = createSortKeyFinder(sortBy, raw);

  return [...raw].sort((a, b) => {
    const ka = keyFinder(a);
    const kb = keyFinder(b);

    return (ka === kb)
      ? a.name.trim().localeCompare(b.name.trim())
      : ka < kb ? -1 : +1;
  });
}

function createSortKeyFinder(sortBy: SortBy, data: Course[]): SortKeyFinder {
  if (sortBy === 'ratings') {
    const MIN_REVIEWS = 10;
    const sum = data.reduce((sum, c) => sum + c.stats.fiveStarRating, 0);
    const avg = sum / data.length;
    const bayesian = (rating: number, reviews: number) =>
      (reviews / (reviews + MIN_REVIEWS)) * rating +
      (MIN_REVIEWS / (reviews + MIN_REVIEWS)) * avg;

    return (c: Course) => {
      return -bayesian(c.stats.fiveStarRating, c.stats.reviews);
    }
  }

  const finders: Record<string, SortKeyFinder> = {
    name:     c => c.name.trim(),
    newest:   c => -(new Date(c.publishedDate)).getTime(),
    shortest: c => +c.duration,
    enrolled: c => -c.stats.enrolled,
    reviews:  c => -c.stats.reviews,
  };

  return finders[sortBy] ?? ((_: Course) => 0);
}

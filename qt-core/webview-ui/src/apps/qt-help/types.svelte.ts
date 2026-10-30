// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

export * from './types.toc.svelte';
export * from './types.index.svelte';

export type UiMode = 'toc' | 'index' | 'text';
export type UiTaskName = 'search' | 'select-package';
export type FindAction = 'new' | 'prev' | 'next' | 'clear';

// type guard functions
export function isUiTaskName(x: string): x is UiTaskName {
  return (x === 'search' || x === 'select-package');
}

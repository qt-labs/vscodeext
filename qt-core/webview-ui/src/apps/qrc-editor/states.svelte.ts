// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import {
  type FileInfo,
  GroupNodeWrapper,
  CursorManager,
  PropInputsManager,
} from './types.svelte';

export const data = $state({
  groups: [] as GroupNodeWrapper[],
  fileInfo: {} as Record<string, FileInfo>,
})

export const ui = $state({
  cursor: new CursorManager(),
  inputs: new PropInputsManager(),
})

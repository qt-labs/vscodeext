// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import TagIcon from './Tag.svelte';
import GridIcon from './Grid.svelte';
import ListIcon from './List.svelte';
import ExtLinkIcon from './ExtLink.svelte';
import FileTagIcon from './FileTag.svelte';
import FolderOpenIcon from './FolderOpen.svelte';
import ChevronRightIcon from './ChevronRight.svelte';

export const icons = {
  Tag: TagIcon,
  Grid: GridIcon,
  List: ListIcon,
  ExtLink: ExtLinkIcon,
  FileTag: FileTagIcon,
  FolderOpen: FolderOpenIcon,
  ChevronRight: ChevronRightIcon,
};

export const glyphs = {
  info: 'ⓘ',
  search: '⌕',
  triangleDown: '▾',
  arrowRightTop:'↗',
  multiplication: '\u2715'
};

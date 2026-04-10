// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import {
  type ExtInfo,
  type BlogArticle,
  type VideoEntry
} from '@shared/welcome';

export const data = $state({
  ext: [] as ExtInfo[],
  blogs: [] as BlogArticle[],
  videos: [] as VideoEntry[],
  timestamps: {
    blog: 0,
    video: 0
  }
});

export const ui = $state({
  config: {
    showOnActivation: false
  },

  overlays: {
    versions: {
      visible: false
    }
  }
})

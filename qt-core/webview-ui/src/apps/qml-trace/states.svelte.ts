// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

export const data = $state({
  configs: {
    fileName: '',
    filePath: "",
    additionalDirs: [] as string[],
  }
})

export const ui = $state({
  overlays: {
    config: {
      visible: false
    }
  }
})

// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

// HTML files are bundled as strings by the esbuild text loader.
declare module '*.html' {
  const content: string;
  export default content;
}

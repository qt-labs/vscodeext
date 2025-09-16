// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

export function toForwardSlash(path: string): string {
  return path.replace(/\\/g, '/');
}

// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { IsWindows } from 'qt-lib';

export function toForwardSlash(path: string): string {
  return path.replace(/\\/g, '/');
}

export function normalizeDriveLetter(p: string): string {
  if (!IsWindows || p.length < 2) {
    return p;
  }

  const drive = p[0];
  if (p[1] === ':' && drive && drive >= 'a' && drive <= 'z') {
    return drive.toUpperCase() + p.slice(1);
  }

  return p;
}

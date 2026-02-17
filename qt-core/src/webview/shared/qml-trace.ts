// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

export type FlameGraphKind = 'time' | 'memory' | 'allocations';

export type QmlTraceCommandReply =
  | { filePath: string; additionalDirs: string[] }
  | { folders: string[] }
  | { themeKind: string }
  | { status: 'done' };

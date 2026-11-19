// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

export type QtProfilerCommandReply =
  | { status: 'done' }
  | { profilerDistUri: string }
  | {
      filePath: string;
      fileName: string;
      bytes: Uint8Array;
    };

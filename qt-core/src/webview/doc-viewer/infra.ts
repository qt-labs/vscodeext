// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { DocViewerHttpServer } from './server/http-server';
import { DocViewerHistoryManager } from './persistence/history';
import { DocViewerBookmarkManager } from './persistence/bookmark';

export interface DocViewerInfra {
  server: DocViewerHttpServer;
  history: DocViewerHistoryManager;
  bookmarks: DocViewerBookmarkManager;
}

export const docViewerInfra: DocViewerInfra = {
  server: new DocViewerHttpServer(),
  history: new DocViewerHistoryManager(),
  bookmarks: new DocViewerBookmarkManager()
};

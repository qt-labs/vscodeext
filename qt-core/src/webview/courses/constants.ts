// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

const academy = 'https://academy.qt.io/';

export const QT_ACADEMY_URL = academy;
export const COURSE_BASE_URL = academy + 'catalog/courses/';
export const LEARNING_PATH_BASE_URL = academy + 'catalog/learning-paths/';
export const CATALOG_JSON_URL = 'https://www.qt.io/hubfs/Academy/courses.json';

export const WEBVIEW_PANEL_COLUMN = vscode.ViewColumn.One;
export const WEBVIEW_PANEL_VIEW_TYPE = 'ViewTypeCoursesBrowser';

export { EXTENSION_ID } from '@/constants';

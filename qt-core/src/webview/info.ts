// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { ViewColumn } from 'vscode';
import { WebAppId } from '@/webview/shared/types';
import * as texts from '@/texts';

interface WebAppInfo {
  appId: WebAppId;
  title: string;
  viewType: string;
  viewColumn: ViewColumn;
  iconPathPrefix: string;
}

export function getWebAppInfo(appId: WebAppId): WebAppInfo {
  const viewColumn = ViewColumn.One;
  const iconPathPrefix = 'res/icons/qt-webview';

  switch (appId) {
    case 'welcome':
      return {
        appId,
        title: texts.WelcomePage.tabText,
        viewType: 'ViewTypeWelcomePage',
        viewColumn,
        iconPathPrefix
      };

    case 'ex-browser':
      return {
        appId,
        title: texts.exBrowser.tabText,
        viewType: 'ViewTypeExBrowser',
        viewColumn,
        iconPathPrefix
      };

    case 'courses':
      return {
        appId,
        title: texts.Courses.tabText,
        viewType: 'ViewTypeCoursesBrowser',
        viewColumn,
        iconPathPrefix
      };

    case 'new-item':
      return {
        appId,
        title: texts.newItem.tabText,
        viewType: 'ViewTypeWizard',
        viewColumn,
        iconPathPrefix
      };

    case 'ui-designer':
      return {
        appId,
        title: 'UI file',
        viewType: '',
        viewColumn,
        iconPathPrefix: 'res/icons/qt-ui'
      };

    case 'qml-trace':
      return {
        appId,
        title: texts.qmlTrace.tabText,
        viewType: '',
        viewColumn,
        iconPathPrefix
      };

    case 'qrc-editor':
      return {
        appId,
        title: 'QRC editor',
        viewType: '',
        viewColumn,
        iconPathPrefix: 'res/icons/qrc'
      };
  }
}

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
    case 'new-item':
      return {
        appId,
        title: texts.newItem.tabText,
        viewType: 'ViewTypeNewItem',
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

    case 'welcome-page':
      return {
        appId,
        title: texts.welcomePage.tabText,
        viewType: 'ViewTypeWelcomePage',
        viewColumn,
        iconPathPrefix
      };

    case 'courses-browser':
      return {
        appId,
        title: texts.coursesBrowser.tabText,
        viewType: 'ViewTypeCoursesBrowser',
        viewColumn,
        iconPathPrefix
      };

    case 'ui-file':
      return {
        appId,
        title: texts.uiFile.tabText,
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
        title: texts.qrcEditor.tabText,
        viewType: '',
        viewColumn,
        iconPathPrefix: 'res/icons/qrc'
      };
  }
}

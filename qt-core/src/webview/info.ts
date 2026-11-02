// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { ViewColumn, WebviewPanelOptions } from 'vscode';
import { WebAppId } from '@/webview/shared/types';
import * as texts from '@/texts';

interface WebAppInfo {
  appId: WebAppId;
  title: string;
  viewType: string;
  viewColumn: ViewColumn;
  iconPathPrefix: string;
  panelOptions: WebviewPanelOptions;
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
        iconPathPrefix,
        panelOptions: { retainContextWhenHidden: false }
      };

    case 'qt-help':
      return {
        appId,
        title: texts.qtHelp.tabText,
        viewType: 'ViewTypeQtHelp',
        viewColumn,
        iconPathPrefix,
        panelOptions: { retainContextWhenHidden: true }
      };

    case 'doc-viewer':
      return {
        appId,
        title: texts.docViewer.tabText,
        viewType: 'ViewTypeDocViewer',
        viewColumn,
        iconPathPrefix,
        panelOptions: { retainContextWhenHidden: true }
      };

    case 'ex-browser':
      return {
        appId,
        title: texts.exBrowser.tabText,
        viewType: 'ViewTypeExBrowser',
        viewColumn,
        iconPathPrefix,
        panelOptions: { retainContextWhenHidden: true }
      };

    case 'welcome-page':
      return {
        appId,
        title: texts.welcomePage.tabText,
        viewType: 'ViewTypeWelcomePage',
        viewColumn,
        iconPathPrefix,
        panelOptions: { retainContextWhenHidden: false }
      };

    case 'courses-browser':
      return {
        appId,
        title: texts.coursesBrowser.tabText,
        viewType: 'ViewTypeCoursesBrowser',
        viewColumn,
        iconPathPrefix,
        panelOptions: { retainContextWhenHidden: true }
      };

    case 'ui-file':
      return {
        appId,
        title: texts.uiFile.tabText,
        viewType: '',
        viewColumn,
        iconPathPrefix: 'res/icons/qt-ui',
        panelOptions: { retainContextWhenHidden: false }
      };

    case 'qml-trace':
      return {
        appId,
        title: texts.qmlTrace.tabText,
        viewType: '',
        viewColumn,
        iconPathPrefix,
        panelOptions: { retainContextWhenHidden: false }
      };

    case 'qrc-editor':
      return {
        appId,
        title: texts.qrcEditor.tabText,
        viewType: '',
        viewColumn,
        iconPathPrefix: 'res/icons/qrc',
        panelOptions: { retainContextWhenHidden: true }
      };
  }
}

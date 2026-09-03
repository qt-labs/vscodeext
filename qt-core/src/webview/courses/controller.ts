// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { telemetry, DisposableStore } from 'qt-lib';
import { basicWebviewAppConfig, configWebviewPanel } from '@/webview/utils';
import * as texts from '@/texts';
import { CoursesDispatcher } from './dispatcher';
import { CoursesDataManager } from './data-manager';
import * as consts from './constants';

type Panel = vscode.WebviewPanel;
type Context = vscode.ExtensionContext;

export function registerOpenCoursesBrowserCommand(context: Context) {
  const name = 'openCoursesBrowser';
  const cmd = `${consts.EXTENSION_ID}.${name}`;

  return vscode.commands.registerCommand(cmd, () => {
    telemetry.sendAction(name);
    CoursesController.render(context);
  });
}

export class CoursesController implements vscode.Disposable {
  public static instance: CoursesController | undefined;

  private readonly _panel: Panel;
  private readonly _data: CoursesDataManager;
  private readonly _dispatcher: CoursesDispatcher;
  private readonly _disposables = new DisposableStore();

  private constructor(context: Context, panel: Panel) {
    configWebviewPanel(panel, {
      appId: 'courses',
      title: texts.Courses.tabText,
      context,
      ...basicWebviewAppConfig
    });

    this._panel = panel;
    this._data = new CoursesDataManager();
    this._dispatcher = new CoursesDispatcher(this._data, panel);

    this._disposables.push(
      this._dispatcher,
      panel.onDidDispose(this.dispose.bind(this))
    );
  }

  public dispose() {
    CoursesController.instance = undefined;
    this._disposables.dispose();
  }

  public static render(context: Context) {
    if (!CoursesController.instance) {
      CoursesController.instance = new CoursesController(
        context,
        vscode.window.createWebviewPanel(
          consts.WEBVIEW_PANEL_VIEW_TYPE,
          texts.Courses.tabText,
          consts.WEBVIEW_PANEL_COLUMN
        )
      );
    }

    CoursesController.instance._panel.reveal(consts.WEBVIEW_PANEL_COLUMN);
  }
}

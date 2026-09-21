// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { telemetry, DisposableStore } from 'qt-lib';
import { WebAppId } from '@/webview/shared/types';
import { setupWebApp, createPanel } from '@/webview/utils';
import { CoursesDispatcher } from './dispatcher';
import { CoursesDataManager } from './data-manager';
import * as consts from './constants';

type Panel = vscode.WebviewPanel;
type Context = vscode.ExtensionContext;

const appId: WebAppId = 'courses-browser';
let instance: CoursesBrowserController | undefined;

export function addCoursesBrowser(context: Context) {
  const openCmd = 'openCoursesBrowser';
  const openCmdFull = `${consts.EXTENSION_ID}.${openCmd}`;

  context.subscriptions.push(
    vscode.commands.registerCommand(openCmdFull, () => {
      telemetry.sendAction(openCmd);
      CoursesBrowserController.render(context);
    })
  );
}

export class CoursesBrowserController implements vscode.Disposable {
  private readonly _data: CoursesDataManager;
  private readonly _dispatcher: CoursesDispatcher;
  private readonly _disposables = new DisposableStore();

  private constructor(
    context: Context,
    private readonly _panel: Panel
  ) {
    setupWebApp(appId, context, this._panel);

    this._data = new CoursesDataManager();
    this._dispatcher = new CoursesDispatcher(this._data, this._panel);
    this._disposables.push(
      this._dispatcher,
      this._panel.onDidDispose(this.dispose.bind(this))
    );
  }

  public dispose() {
    instance = undefined;
    this._disposables.dispose();
  }

  public static render(context: Context) {
    instance ??= new CoursesBrowserController(context, createPanel(appId));
    instance._panel.reveal();
  }
}

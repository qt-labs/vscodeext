// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import _ from 'lodash';
import * as vscode from 'vscode';

import { createLogger } from 'qt-lib';
import { WebviewChannel } from '@/webview/channel';
import {
  Command,
  CommandId,
  CommandHandler,
  IsCommand
} from '@/webview/shared/message';
import { isCourseType } from '@/webview/shared/courses';
import { CoursesDataManager } from './data-manager';
import * as consts from './constants';

const logger = createLogger('course-dispatcher');

export class CoursesDispatcher {
  private readonly _comm: WebviewChannel;
  private readonly _handlers: Map<CommandId, CommandHandler> | undefined;
  private readonly _disposables: vscode.Disposable[] = [];

  public constructor(
    private readonly _data: CoursesDataManager,
    panel: vscode.WebviewPanel
  ) {
    this._comm = new WebviewChannel(panel.webview);
    this._handlers = new Map<CommandId, CommandHandler>([
      [CommandId.CoursesGetCourses, this._onGetCourses],
      [CommandId.CoursesRunAction, this._onRunAction]
    ]);

    this._disposables = [
      this._comm,
      this._comm.onDidReceiveMessage((m) => {
        this.dispatch(m);
      })
    ];
  }

  public dispose() {
    this._disposables.forEach((d) => void d.dispose());
    this._disposables.length = 0;
  }

  public dispatch(cmd: unknown) {
    if (!IsCommand(cmd)) {
      return;
    }

    const handler = this._handlers?.get(cmd.id);
    if (!handler) {
      logger.warn(`unhandled command: id = ${CommandId[cmd.id]}`);
      return;
    }

    try {
      void handler(cmd);
    } catch (e) {
      logger.error(`Cannot handle command '${String(cmd.id)}': ${String(e)}`);
    }
  }

  // handlers
  private readonly _onGetCourses = async (cmd: Command) => {
    await this._data.ensureLoaded();
    this._comm.postDataReply(cmd, this._data.courses);
  };

  private readonly _onRunAction = (cmd: Command) => {
    const action = String(_.get(cmd.payload, 'action', '')).trim();
    const id = _.get(cmd.payload, 'course.id', -1) as number;
    const type = String(_.get(cmd.payload, 'course.type', '')).trim();

    switch (action) {
      case 'open-course':
        if (id > 0 && isCourseType(type)) {
          const base = vscode.Uri.parse(
            type === 'course'
              ? consts.COURSE_BASE_URL
              : consts.LEARNING_PATH_BASE_URL
          );

          const fullUri = vscode.Uri.joinPath(base, String(id));
          void vscode.env.openExternal(fullUri);
          this._comm.postDataReply(cmd, { status: 'done' });
        }
        break;

      case 'open-academy-home':
        void vscode.env.openExternal(vscode.Uri.parse(consts.QT_ACADEMY_URL));
        this._comm.postDataReply(cmd, { status: 'done' });
        break;

      default:
        break;
    }
  };
}

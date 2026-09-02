// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import _ from 'lodash';
import * as vscode from 'vscode';

import { isCourseType } from '@/webview/shared/courses';
import { WebviewDispatcher } from '@/webview/dispatcher';
import { Command, CommandId } from '@/webview/shared/message';
import { CoursesDataManager } from './data-manager';
import * as consts from './constants';

export class CoursesDispatcher extends WebviewDispatcher {
  public constructor(
    private readonly _data: CoursesDataManager,
    panel: vscode.WebviewPanel
  ) {
    super('courses', panel);
    this.setHandlers([
      [CommandId.CoursesGetCourses, this._onGetCourses],
      [CommandId.CoursesRunAction, this._onRunAction]
    ]);
  }

  // handlers
  private readonly _onGetCourses = async (cmd: Command) => {
    await this._data.ensureLoaded();
    this.channel.replyData(cmd, this._data.courses);
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
          this.channel.replyDone(cmd);
        }
        break;

      case 'open-academy-home':
        void vscode.env.openExternal(vscode.Uri.parse(consts.QT_ACADEMY_URL));
        this.channel.replyDone(cmd);
        break;

      default:
        break;
    }
  };
}

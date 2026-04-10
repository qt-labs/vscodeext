// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import _ from 'lodash';
import * as vscode from 'vscode';

import { createLogger } from 'qt-lib';
import { WebviewChannel } from '@/webview/channel';
import { DataType } from '@/webview/shared/welcome';
import {
  Command,
  CommandId,
  CommandHandler,
  IsCommand
} from '@/webview/shared/message';
import { WelcomePageDataManager } from './data-manager';
import * as consts from './constants';

const logger = createLogger('tutorial-dispatcher');

export class WelcomePageDispatcher {
  private readonly _comm: WebviewChannel;
  private readonly _handlers: Map<CommandId, CommandHandler> | undefined;
  private readonly _disposables: vscode.Disposable[] = [];

  public constructor(
    private readonly _data: WelcomePageDataManager,
    panel: vscode.WebviewPanel
  ) {
    this._comm = new WebviewChannel(panel.webview);
    this._handlers = new Map<CommandId, CommandHandler>([
      [CommandId.WelcomeGetData, this._onGetData],
      [CommandId.WelcomeHandleConfig, this._onHandleConfig],
      [CommandId.WelcomeRunAction, this._onRunAction]
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

  private readonly _onGetData = async (cmd: Command) => {
    this._data.ensureExtInfoLoaded();
    await this._data.ensureBlogLoaded();
    await this._data.ensureVideoLoaded();

    this._comm.postDataReply(cmd, {
      extInfo: this._data.extInfo,
      blogArticles: this._data.blogArticles,
      videoEntries: this._data.videoEntries,
      timestamps: this._data.timestamps
    });
  };

  private readonly _onHandleConfig = async (cmd: Command) => {
    const key = consts.CONFIG_KEY_SHOW_ON_ACTIVATION;
    const config = vscode.workspace.getConfiguration(consts.EXTENSION_ID);
    const access = String(_.get(cmd.payload, 'access', ''))
      .trim()
      .toLowerCase();

    if (access === 'set') {
      const v = _.get(cmd.payload, 'showOnActivation', true);
      await config.update(key, v, vscode.ConfigurationTarget.Global);
      this._comm.postDataReply(cmd, { status: 'done' });
    }

    if (access === 'get') {
      this._comm.postDataReply(cmd, {
        showOnActivation: config.get<boolean>(key) ?? true
      });
    }
  };

  private readonly _onRunAction = async (cmd: Command) => {
    const action = String(_.get(cmd.payload, 'action', '')).trim();

    switch (action) {
      case 'openUrl': {
        const url = String(_.get(cmd.payload, 'args.url', '')).trim();
        void openExt(url);
        break;
      }

      case 'openWebsite': {
        const website = String(_.get(cmd.payload, 'args.id', '')).trim();
        const urls: Record<string, string> = {
          'qt-docs': consts.QT_DOCS_URL,
          'qt-blogs': consts.QT_BLOG_URL,
          'qt-download': consts.QT_DOWNLOAD_URL,
          'qt-youtube-channel': consts.QT_YOUTUBE_CHANNEL_URL,
          'qtforpython-doc': consts.QT_FOR_PYTHON_DOC_URL,
          'bug-report': consts.BUG_REPORT_URL,
          documentation: consts.DOC_URL
        };

        const url = urls[website];
        if (url) {
          void openExt(url);
        }
        break;
      }

      case 'openWebview': {
        const webview = String(_.get(cmd.payload, 'args.id', '')).trim();
        const commands: Record<string, string> = {
          'new-project': 'qt-core.createNewItem',
          examples: 'qt-core.openExamplesBrowser',
          courses: 'qt-core.openCoursesBrowser'
        };

        const c = commands[webview];
        if (c) {
          void vscode.commands.executeCommand(c);
        }
        break;
      }

      case 'openMarketplace': {
        const id = String(_.get(cmd.payload, 'args.id', '')).trim();
        void vscode.commands.executeCommand('extension.open', id);
        void vscode.commands.executeCommand(
          'workbench.extensions.search',
          `@id:${id}`
        );
        break;
      }

      case 'refresh-data': {
        const type = String(_.get(cmd.payload, 'args.type', '')).trim();
        await this._data.refresh(type as DataType);
        break;
      }

      default:
        return;
    }

    this._comm.postDataReply(cmd, { status: 'done' });
  };
}

// helpers
async function openExt(url: string) {
  await vscode.env.openExternal(vscode.Uri.parse(url));
}

// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import _ from 'lodash';
import { WebviewPanel as Panel, ExtensionContext as ExtContext } from 'vscode';

import { fsDir } from '@/fs-utils';
import { isDocRootInfo } from '@/webview/shared/qt-help';
import { DocViewerInfra } from '@/webview/doc-viewer/infra';
import { Command, CommandId } from '@/webview/shared/message';
import { DocViewerDispatcher } from '@/webview/doc-viewer/dispatcher';
import { QtHelpDataManager } from './data/data-manager';

export class QtHelpDispatcher extends DocViewerDispatcher {
  private readonly _data: QtHelpDataManager;

  public constructor(
    extContext: ExtContext,
    panel: Panel,
    docViewerInfra: DocViewerInfra
  ) {
    super(extContext, panel, docViewerInfra, {
      origin: 'qt-help',
      syncPanelTitle: false
    });

    this._data = new QtHelpDataManager(extContext);
    this.setHandlers([
      [CommandId.QtHelpGetDocRoots, this._onGetDocRoots],
      [CommandId.QtHelpSelectDocRoot, this._onSelectDocRoot],
      [CommandId.QtHelpRevealDocRootFolder, this._onRevealDocRootFolder],
      [CommandId.QtHelpReadToc, this._onReadToc],
      [CommandId.QtHelpReadIndexes, this._onReadIndexes],
      [CommandId.QtHelpSearchFullText, this._onSearchFullText]
    ]);
  }

  private readonly _onGetDocRoots = (cmd: Command) => {
    const data = this._data.readAllDocRoots();
    this.channel.replyData(cmd, data);
  };

  private readonly _onSelectDocRoot = (cmd: Command) => {
    const doc = _.get(cmd.payload, 'doc', {});
    if (!isDocRootInfo(doc)) {
      return;
    }

    this._data.selectDoc(doc);
    this.channel.replyData(cmd, { homeUri: this._data.getHomeUri() });
  };

  private readonly _onRevealDocRootFolder = (cmd: Command) => {
    const doc = _.get(cmd.payload, 'doc', {});
    if (!isDocRootInfo(doc)) {
      return;
    }

    fsDir(doc.fsPath).revealInFileManager();
    this.channel.replyDone(cmd);
  };

  private readonly _onReadToc = async (cmd: Command) => {
    const data = await this._data.readToc();
    this.channel.replyData(cmd, data);
  };

  private readonly _onReadIndexes = async (cmd: Command) => {
    const data = await this._data.readIndexes();
    this.channel.replyData(cmd, data);
  };

  private readonly _onSearchFullText = async (cmd: Command) => {
    const keyword = String(_.get(cmd.payload, 'keyword', '')).trim();

    const result = await this._data.searchFullText(keyword);
    this.channel.replyData(cmd, { result, keyword });
  };
}

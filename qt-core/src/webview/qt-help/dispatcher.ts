// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import _ from 'lodash';
import { WebviewPanel as Panel, ExtensionContext as ExtContext } from 'vscode';

import { fsDir } from '@/fs-utils';
import { isDocRootInfo } from '@/webview/shared/qt-help';
import { Command, CommandId } from '@/webview/shared/message';
import { DocViewerInfra } from '@/webview/doc-viewer/infra';
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
      [CommandId.QtHelpGetPackages, this._onGetPackages],
      [CommandId.QtHelpSelectPackage, this._onSelectPackage],
      [CommandId.QtHelpRevealPackageFolder, this._onRevealPackageFolder],
      [CommandId.QtHelpReadToc, this._onReadToc],
      [CommandId.QtHelpReadIndexes, this._onReadIndexes],
      [CommandId.QtHelpSearchFullText, this._onSearchFullText]
    ]);
  }

  private readonly _onGetPackages = (cmd: Command) => {
    const data = this._data.getPackages();
    this.channel.replyData(cmd, data);
  };

  private readonly _onSelectPackage = (cmd: Command) => {
    const p = _.get(cmd.payload, 'package', {});
    if (!isDocRootInfo(p)) {
      return;
    }

    this._data.selectPackage(p);
    this.channel.replyData(cmd, { homeUri: this._data.getHomeUri() });
  };

  private readonly _onRevealPackageFolder = (cmd: Command) => {
    const p = _.get(cmd.payload, 'package', {});
    if (!isDocRootInfo(p)) {
      return;
    }

    fsDir(p.fsPath).revealInFileManager();
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

// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import _ from 'lodash';
import * as path from 'path';
import {
  env,
  Uri,
  Disposable,
  WebviewPanel as Panel,
  ExtensionMode as ExtMode,
  ExtensionContext as ExtContext
} from 'vscode';

import {
  NamedUri,
  OpenOptions,
  OpenInTarget,
  isHistoryEdit,
  isBookmarkEdit,
  isOpenInTarget
} from '@/webview/shared/doc-viewer';
import { fsFile } from '@/fs-utils';
import { WebviewDispatcher } from '@/webview/dispatcher';
import { Command, CommandId } from '@/webview/shared/message';
import { DocViewerInfra } from './infra';
import { openDocViewer } from './controller';
import { DocViewerHttpServer } from './server/http-server';
import * as consts from './constants';

export class DocViewerDispatcher extends WebviewDispatcher {
  private readonly _currentUri: NamedUri = { uri: '', title: '' };
  private readonly _disposable: Disposable | undefined;

  public constructor(
    private readonly _extContext: ExtContext,
    private readonly _panel: Panel,
    private readonly _infra: DocViewerInfra,
    private readonly _openOptions: OpenOptions
  ) {
    super('doc-viewer', _panel);

    this.setHandlers([
      [CommandId.DocViewerGetConfig, this._onGetConfig],
      [CommandId.DocViewerSetViewerState, this._onSetViewerState],
      [CommandId.DocViewerOpenDoc, this._onOpenDoc],
      [CommandId.DocViewerGetBookmarks, this._onGetBookmarks],
      [CommandId.DocViewerEditBookmarks, this._onEditBookmarks],
      [CommandId.DocViewerGetHistories, this._onGetHistories],
      [CommandId.DocViewerEditHistories, this._onEditHistories]
    ]);

    const css = this._infra.server.cssManager();
    css.setCssPath(
      path.join(
        this._extContext.extensionPath,
        consts.CssSubDir,
        consts.CssFileName
      )
    );

    if (this._extContext.extensionMode === ExtMode.Development) {
      this._disposable = css.onCssChanged(() => {
        this.channel.notify(CommandId.DocViewerReloadPage);
      });
    }
  }

  public override dispose() {
    this._disposable?.dispose();
    super.dispose();
  }

  public get currentUri() {
    return this._currentUri;
  }

  private readonly _onGetConfig = (cmd: Command) => {
    this.channel.replyData(cmd, {
      homeUri: this._openOptions.homeUri ?? '',
      serverOrigin: this._infra.server.baseUri.toString()
    });
  };

  private readonly _onSetViewerState = (cmd: Command) => {
    const c = this._currentUri;
    c.uri = String(_.get(cmd.payload, 'uri', c.uri)).trim();
    c.title = String(_.get(cmd.payload, 'title', c.title)).trim();

    if (this._openOptions.syncPanelTitle === true) {
      const parsed = this._currentUri.title.split(consts.TitleSeparator);
      this._panel.title = parsed[0] ?? '';
    }

    this.channel.replyDone(cmd);
  };

  private readonly _onOpenDoc = (cmd: Command) => {
    const resolve = resolveDoc(
      String(_.get(cmd.payload, 'uri', '')),
      String(_.get(cmd.payload, 'target', '')),
      this._infra.server
    );

    if (resolve.kind === 'dispatch') {
      switch (resolve.target) {
        case 'new':
          void openDocViewer(resolve.uri, {
            origin: this._openOptions.origin,
            syncPanelTitle: true,
            forceNewWindow: true
          });
          break;

        case 'vscode-env':
          void env.openExternal(resolve.uri);
          break;

        case 'file-manager':
          fsFile(resolve.uri.fsPath).revealInFileManager();
          break;
      }
    }

    this.channel.replyData(cmd, resolve);
  };

  private readonly _onGetBookmarks = (cmd: Command) => {
    this.channel.replyData(cmd, {
      entries: this._infra.bookmarks.entries
    });
  };

  private readonly _onEditBookmarks = async (cmd: Command) => {
    const edit = _.get(cmd.payload, 'edit', {});
    if (!isBookmarkEdit(edit)) {
      return;
    }

    const affected = this._infra.bookmarks.edit(edit);
    if (affected) {
      await this._infra.bookmarks.save();
    }

    this.channel.replyData(cmd, {
      entries: this._infra.bookmarks.entries
    });
  };

  private readonly _onGetHistories = (cmd: Command) => {
    this.channel.replyData(cmd, {
      entries: this._infra.history.entries
    });
  };

  private readonly _onEditHistories = async (cmd: Command) => {
    const edit = _.get(cmd.payload, 'edit', {});
    if (!isHistoryEdit(edit)) {
      return;
    }

    const affected = this._infra.history.edit(edit);
    if (affected) {
      await this._infra.history.save();
    }

    this.channel.replyData(cmd, {
      entries: this._infra.history.entries
    });
  };
}

// helpers
type ResolveDocResult =
  | { kind: 'load'; serviceUri: string }
  | { kind: 'error'; errorCode: string }
  | {
      kind: 'dispatch';
      target: Exclude<OpenInTarget, 'current'>;
      uri: Uri;
    };

const badData = { kind: 'error', errorCode: '400' } as ResolveDocResult;
const notFound = { kind: 'error', errorCode: '404' } as ResolveDocResult;

function resolveDoc(
  uri_s: string,
  target: string,
  server: DocViewerHttpServer
): ResolveDocResult {
  let uri: Uri;

  try {
    if (!isOpenInTarget(target)) {
      throw new Error('400');
    }

    uri = Uri.parse(uri_s, true);
  } catch {
    return badData;
  }

  const redirect = server.getRedirectUri(uri);
  const isExternal = !server.matchesOrigin(redirect);

  if (isExternal) {
    return { kind: 'dispatch', target: 'vscode-env', uri };
  } else {
    if (!fsFile(redirect.path).exists()) {
      return notFound;
    }

    if (target !== 'current') {
      return { kind: 'dispatch', target, uri };
    } else {
      return { kind: 'load', serviceUri: redirect.toString() };
    }
  }
}

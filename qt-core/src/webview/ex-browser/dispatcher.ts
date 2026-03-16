// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import _ from 'lodash';
import * as path from 'path';
import * as vscode from 'vscode';

import { createLogger } from 'qt-lib';
import { WebviewChannel } from '@/webview/channel';
import {
  Command,
  CommandId,
  CommandHandler,
  IsCommand
} from '@/webview/shared/message';
import {
  isExEntry,
  isExPackage,
  isExCategory,
  isExNewProjectArgs,
  ExBrowserViewConfig
} from '@/webview/shared/ex-browser';
import { getNewProjectBaseDir } from '@/qtcli/commands';
import { QtcliRestClient, QtcliRestError } from '@/qtcli/rest';
import * as texts from '@/texts';
import { fsDir, fsFile } from '@/fs-utils';
import * as helpers from './helpers';
import { ExDataManager } from './data-manager';
import { ExImageUriResolver } from './resolvers';

type Panel = vscode.WebviewPanel;
type Context = vscode.ExtensionContext;

const logger = createLogger('ex-browser-dispatcher');

export class ExBrowserDispatcher {
  private readonly _comm: WebviewChannel;
  private readonly _handlers: Map<CommandId, CommandHandler> | undefined;
  private readonly _qtcliRest: QtcliRestClient;
  private readonly _viewConfig: ExBrowserViewConfig;
  private readonly _imageUriResolver: ExImageUriResolver;
  private readonly _disposables: vscode.Disposable[] = [];

  public constructor(
    private readonly _data: ExDataManager,
    private readonly _context: Context,
    panel: Panel,
    qtcliSocketName: string
  ) {
    this._comm = new WebviewChannel(panel.webview);
    this._handlers = new Map<CommandId, CommandHandler>([
      [CommandId.ExBrowserGetPackages, this._onGetPackages],
      [CommandId.ExBrowserGetExamples, this._onGetExamples],
      [CommandId.ExBrowserSelectPackage, this._onSelectPackage],
      [CommandId.ExBrowserResolveImageUrl, this._onResolveImageUrl],
      [CommandId.ExBrowserRunActionOnExample, this._onRunActionOnExample],
      [CommandId.CommonOpenFolder, this._onOpenFolder],
      [CommandId.UiSelectWorkingDir, this._onSelectWorkingDir],
      [CommandId.UiValidateInputs, this._onUiValidateInputs],
      [CommandId.UiGetConfigs, this._onUiGetConfigs],
      [CommandId.UiSaveOpenInPreference, this._onUiSaveOpenInPreference]
    ]);

    this._qtcliRest = new QtcliRestClient(qtcliSocketName);
    this._viewConfig = helpers.createViewConfig(this._context);
    this._imageUriResolver = new ExImageUriResolver(
      panel.webview,
      this._context
    );

    this._disposables = [
      this._comm,
      this._comm.onDidReceiveMessage((m) => {
        this.dispatch(m);
      })
    ];
  }

  public dispose() {
    void this._qtcliRest.delete('/server');

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
  private readonly _onGetPackages = (cmd: Command) => {
    this._comm.postDataReply(cmd, this._data.packages);
  };

  private readonly _onGetExamples = (cmd: Command) => {
    const query = String(_.get(cmd.payload, 'query', '')).trim();
    const category = _.get(cmd.payload, 'category', {});
    if (!isExCategory(category)) {
      throw Error('Parameter is invalid');
    }

    const r = this._data.search(category, query);
    this._comm.postDataReply(cmd, r);
  };

  private readonly _onSelectPackage = (cmd: Command) => {
    const p = _.get(cmd.payload, 'package', {});
    if (!isExPackage(p)) {
      throw Error('Parameter is invalid');
    }

    this._data.selectPackage(p);
    this._comm.postDataReply(cmd, {
      info: p,
      categories: this._data.categories,
      resolvedPaths: this._data.resolvedPaths
    });
  };

  private readonly _onResolveImageUrl = (cmd: Command) => {
    const example = _.get(cmd.payload, 'example', {});
    if (!isExEntry(example)) {
      throw Error('Parameter is invalid');
    }

    const resolvedPaths = this._data.resolvedPaths[example.projectPath];
    if (!resolvedPaths) {
      throw Error('Parameter is invalid');
    }

    const webviewUrl = this._imageUriResolver
      .resolveWebUri(example, resolvedPaths)
      .toString();

    this._comm.postDataReply(cmd, { webviewUrl });
  };

  private readonly _onRunActionOnExample = async (cmd: Command) => {
    const action = String(_.get(cmd.payload, 'action', '')).trim();
    const example = _.get(cmd.payload, 'example', {});
    if (!isExEntry(example)) {
      throw Error('Parameter is invalid');
    }

    const resolvedPaths = this._data.resolvedPaths[example.projectPath];
    if (!resolvedPaths) {
      throw Error('Parameter is invalid');
    }

    if (action === 'file-open') {
      const rel = String(_.get(cmd.payload, 'args.file', '')).trim();
      const abs = resolvedPaths.filesToOpen[rel] ?? '';
      void fsFile(abs).openInEditor();
    }

    if (action.startsWith('project')) {
      const abs = resolvedPaths.projectDir;

      if (action === 'project-open') {
        void fsDir(abs).openAsWorkspace({ newWindow: true });
      } else if (action === 'project-open-file') {
        void fsFile(resolvedPaths.projectFile).openInEditor();
      } else if (action === 'project-reveal') {
        void fsDir(abs).revealInFileManager();
      } else if (action === 'project-create') {
        const args = _.get(cmd.payload, 'args', {});
        if (isExNewProjectArgs(args)) {
          // example.projectPath: "charts/qmlchartsgallery/CMakeLists.txt"
          const rel = example.projectPath;
          const originalName = path.basename(path.dirname(rel));

          helpers.createNewProject(args, abs, originalName);
          await helpers.saveNewProjectArgs(args, this._context);
        }
      }
    }

    if (action.startsWith('doc')) {
      const file = fsFile(resolvedPaths.doc);

      if (action === 'doc-open-external') {
        void file.openExternal();
      } else {
        await vscode.commands.executeCommand('workbench.action.splitEditor');
        void file.openInSimpleBrowser();
      }
    }

    this._comm.postDataReply(cmd, { status: 'done' });
  };

  private readonly _onOpenFolder = (cmd: Command) => {
    const folder = String(_.get(cmd.payload, 'folder', '')).trim();
    if (folder) {
      void fsDir(folder).revealInFileManager();
    }

    this._comm.postDataReply(cmd, { status: 'done' });
  };

  private readonly _onSelectWorkingDir = async (cmd: Command) => {
    const dir = cmd.payload?.toString() ?? getNewProjectBaseDir();
    const options: vscode.OpenDialogOptions = {
      canSelectMany: false,
      canSelectFolders: true,
      canSelectFiles: false,
      openLabel: texts.newItem.workingDirDialogTitle,
      defaultUri: vscode.Uri.file(dir)
    };

    const folderUri = await vscode.window.showOpenDialog(options);
    if (folderUri && folderUri.length > 0) {
      let folder = folderUri[0]?.fsPath ?? '';
      if (process.platform === 'win32' && /^[a-z]:/.test(folder)) {
        folder = folder.charAt(0).toUpperCase() + folder.slice(1);
      }

      this._comm.postDataReply(cmd, folder);
    }
  };

  private readonly _onUiValidateInputs = async (cmd: Command) => {
    try {
      const data = await this._qtcliRest.post('/items/validate', cmd.payload);
      this._comm.postDataReply(cmd, data);
    } catch (e) {
      if (e instanceof QtcliRestError) {
        this._comm.postErrorReplyFrom(cmd, e.message, e.details);
      }
    }
  };

  private readonly _onUiGetConfigs = (cmd: Command) => {
    this._comm.postDataReply(cmd, this._viewConfig);
  };

  private readonly _onUiSaveOpenInPreference = async (cmd: Command) => {
    await helpers.saveOpenInArg(
      String(cmd.payload) as 'addToWorkspace' | 'newWindow',
      this._context
    );

    this._comm.postDataReply(cmd, { status: 'done' });
  };
}

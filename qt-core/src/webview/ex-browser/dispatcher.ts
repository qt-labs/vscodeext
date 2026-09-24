// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import _ from 'lodash';
import * as path from 'path';
import * as vscode from 'vscode';

import { normalizeDriveLetter } from 'qt-lib';
import { WebviewDispatcher } from '@/webview/dispatcher';
import { Command, CommandId } from '@/webview/shared/message';
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
import { isOpenInPreference } from '../shared/types';

type Panel = vscode.WebviewPanel;
type Context = vscode.ExtensionContext;

export class ExBrowserDispatcher extends WebviewDispatcher {
  private readonly _qtcliRest: QtcliRestClient;
  private readonly _viewConfig: ExBrowserViewConfig;
  private readonly _imageUriResolver: ExImageUriResolver;

  public constructor(
    private readonly _data: ExDataManager,
    private readonly _extensionContext: Context,
    panel: Panel,
    qtcliSocketName: string
  ) {
    super('ex-browser', panel);
    this.setHandlers([
      [CommandId.ExBrowserGetPackages, this._onGetPackages],
      [CommandId.ExBrowserGetExamples, this._onGetExamples],
      [CommandId.ExBrowserSelectPackage, this._onSelectPackage],
      [CommandId.ExBrowserResolveImageUrl, this._onResolveImageUrl],
      [CommandId.ExBrowserRunActionOnExample, this._onRunActionOnExample],
      [CommandId.ExBrowserSelectWorkingDir, this._onSelectWorkingDir],
      [CommandId.ExBrowserValidateInputs, this._onValidateInputs],
      [CommandId.ExBrowserGetConfigs, this._onGetConfigs],
      [CommandId.ExBrowserSaveOpenInPreference, this._onSaveOpenInPreference],
      [CommandId.CommonRevealFolder, this._onRevealFolder]
    ]);

    this._qtcliRest = new QtcliRestClient(qtcliSocketName);
    this._viewConfig = helpers.createViewConfig(this._extensionContext);
    this._imageUriResolver = new ExImageUriResolver(
      panel.webview,
      this._extensionContext
    );
  }

  public override dispose() {
    void this._qtcliRest.delete('/server');
    super.dispose();
  }

  // handlers
  private readonly _onGetPackages = (cmd: Command) => {
    this.channel.replyData(cmd, this._data.packages);
  };

  private readonly _onGetExamples = (cmd: Command) => {
    const query = String(_.get(cmd.payload, 'query', '')).trim();
    const category = _.get(cmd.payload, 'category', {});
    if (!isExCategory(category)) {
      throw Error('Parameter is invalid');
    }

    const r = this._data.search(category, query);
    this.channel.replyData(cmd, r);
  };

  private readonly _onSelectPackage = async (cmd: Command) => {
    const p = _.get(cmd.payload, 'package', {});
    if (!isExPackage(p)) {
      throw Error('Parameter is invalid');
    }

    await this._data.selectPackage(p);
    this.channel.replyData(cmd, {
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

    this.channel.replyData(cmd, { webviewUrl });
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
      } else if (action === 'project-open-as-workspace') {
        void fsDir(abs).openAsWorkspace({ newWindow: false });
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

          helpers.createNewProject(
            args,
            abs,
            originalName,
            this._data.qtInstallation
          );
          await helpers.saveNewProjectArgs(args, this._extensionContext);
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

    this.channel.replyDone(cmd);
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
      this.channel.replyData(
        cmd,
        normalizeDriveLetter(folderUri[0]?.fsPath ?? '')
      );
    }
  };

  private readonly _onValidateInputs = async (cmd: Command) => {
    try {
      const data = await this._qtcliRest.post('/items/validate', cmd.payload);
      this.channel.replyData(cmd, data);
    } catch (e) {
      if (e instanceof QtcliRestError) {
        this.channel.replyErrorFrom(cmd, e.message, e.details);
      }
    }
  };

  private readonly _onGetConfigs = (cmd: Command) => {
    this.channel.replyData(cmd, this._viewConfig);
  };

  private readonly _onSaveOpenInPreference = async (cmd: Command) => {
    if (isOpenInPreference(cmd.payload)) {
      await helpers.saveOpenInArg(cmd.payload, this._extensionContext);
    }

    this.channel.replyDone(cmd);
  };

  private readonly _onRevealFolder = (cmd: Command) => {
    const folder = String(_.get(cmd.payload, 'folder', '')).trim();
    if (folder) {
      void fsDir(folder).revealInFileManager();
    }

    this.channel.replyDone(cmd);
  };
}

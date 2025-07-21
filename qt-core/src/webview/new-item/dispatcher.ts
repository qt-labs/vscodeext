// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import _ from 'lodash';
import * as path from 'path';
import * as vscode from 'vscode';

import { createLogger } from 'qt-lib';
import * as texts from '@/texts';
import { QtcliRestClient, QtcliRestError } from '@/qtcli/rest';
import { openFilesUnder, openUri } from '@/qtcli/common';
import {
  getNewFileBaseDir,
  getNewProjectBaseDir,
  setDefaultProjectDir
} from '@/qtcli/commands';
import { WebviewChannel } from '@/webview/channel';
import { Command, CommandId, IsCommand } from '@/webview/shared/message';
import type { NewItemPanel } from './panel';

const logger = createLogger('new-item-handler');
type CommandHandler = (command: Command) => void | Promise<void>;

export class NewItemDispatcher {
  private readonly _qtcliRest = new QtcliRestClient();
  private readonly _handlers: Map<CommandId, CommandHandler> | undefined;
  private _comm: WebviewChannel | undefined;
  private _panel: NewItemPanel | undefined = undefined;

  public constructor() {
    this._handlers = new Map<CommandId, CommandHandler>([
      [CommandId.UiClosed, this.onUiClosed],
      [CommandId.UiItemCreationRequested, this.onUiItemCreationRequested],
      [CommandId.UiHasError, this.onUiHasError],
      [CommandId.UiCheckIfQtcliReady, this.onUiCheckIfQtcliReady],
      [CommandId.UiGetConfigs, this.onUiGetConfigs],
      [CommandId.UiGetAllPresets, this.onUiGetAllPresets],
      [CommandId.UiGetPresetById, this.onUiGetPresetById],
      [CommandId.UiValidateInputs, this.onUiValidateInputs],
      [CommandId.UiManageCustomPreset, this.onUiManageCustomPreset],
      [CommandId.UiSelectWorkingDir, this.onUiSelectWorkingDir]
    ]);
  }

  public dispose() {
    void this._qtcliRest.delete('/server');
  }

  public setPanel(p: NewItemPanel) {
    this._panel = p;
  }

  public setComm(c: WebviewChannel) {
    this._comm = c;
  }

  public dispatch(cmd: unknown) {
    if (!this._panel || !IsCommand(cmd)) {
      return;
    }

    const handler = this._handlers?.get(cmd.id);
    if (!handler) {
      logger.warn(`unhandled command: id = ${cmd.id}`);
      return;
    }

    try {
      void handler(cmd);
    } catch (e) {
      logger.error(`Error while handling command '${cmd.id}': ${String(e)}`);
    }
  }

  private readonly onUiClosed = () => {
    this._panel?.close();
  };

  private readonly onUiItemCreationRequested = async (cmd: Command) => {
    try {
      const data = await this._qtcliRest.call({
        method: 'post',
        url: '/items',
        data: cmd.payload
      });

      openItemsFromQtcliResponseData(data);

      const type = _.get(cmd.payload, 'type', '') as string;
      const save = _.get(cmd.payload, 'saveProjectDir', false) as boolean;
      const workingDir = _.get(data, 'workingDir', '') as string;

      if (type === 'project' && save && workingDir.length !== 0) {
        await setDefaultProjectDir(workingDir);
      }

      this._panel?.close();
    } catch (e) {
      if (e instanceof QtcliRestError) {
        await vscode.window.showErrorMessage(e.toString());
      }
    }
  };

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  private readonly onUiHasError = (cmd: Command) => {
    const msg = _.toString(cmd.payload);
    logger.error(`UI Error: ${msg}`);
  };

  private readonly onUiCheckIfQtcliReady = async (cmd: Command) => {
    try {
      const data = await this._qtcliRest.retryCall({
        method: 'get',
        url: '/ready'
      });
      this._comm?.postDataReply(cmd, data);
    } catch {
      await vscode.window.showErrorMessage(texts.newItem.errorQtCliNotReady);
    }
  };

  private readonly onUiGetConfigs = (cmd: Command) => {
    this._comm?.postDataReply(cmd, {
      newFileBaseDir: getNewFileBaseDir(),
      newProjectBaseDir: getNewProjectBaseDir()
    });
  };

  private readonly onUiGetAllPresets = async (cmd: Command) => {
    const data = await this._qtcliRest.get('/presets', { type: cmd.payload });
    this._comm?.postDataReply(cmd, data);
  };

  private readonly onUiGetPresetById = async (cmd: Command) => {
    const id = _.toString(cmd.payload);
    const data = await this._qtcliRest.get(`/presets/${id}`);
    this._comm?.postDataReply(cmd, data);
  };

  private readonly onUiManageCustomPreset = async (cmd: Command) => {
    const action = _.get(cmd.payload, 'action', '') as string;
    const presetId = _.get(cmd.payload, 'presetId', '') as string;
    if (presetId.length === 0) {
      return;
    }

    try {
      switch (action) {
        case 'create': {
          const data = await this._qtcliRest.post('/presets', cmd.payload);
          this._comm?.postDataReply(cmd, data);
          break;
        }

        case 'rename': {
          await this._qtcliRest.post('/presets', cmd.payload);
          await this._qtcliRest.delete(`/presets/${presetId}`);
          this._comm?.postDataReply(cmd, cmd.payload);
          break;
        }

        case 'update': {
          await this._qtcliRest.patch(`/presets/${presetId}`, cmd.payload);
          this._comm?.postDataReply(cmd, cmd.payload);
          break;
        }

        case 'delete': {
          const data = await this._qtcliRest.delete(`/presets/${presetId}`);
          this._comm?.postDataReply(cmd, data);
          break;
        }
      }
    } catch (e) {
      if (e instanceof QtcliRestError) {
        await vscode.window.showErrorMessage(e.toString());
        this._comm?.postErrorReplyFrom(cmd, e.message, e.details);
      }
    }
  };

  private readonly onUiValidateInputs = async (cmd: Command) => {
    try {
      const data = await this._qtcliRest.post('/items/validate', cmd.payload);
      this._comm?.postDataReply(cmd, data);
    } catch (e) {
      if (e instanceof QtcliRestError) {
        this._comm?.postErrorReplyFrom(cmd, e.message, e.details);
      }
    }
  };

  private readonly onUiSelectWorkingDir = async (cmd: Command) => {
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

      this._comm?.postDataReply(cmd, folder);
    }
  };
}

// helpers
function openItemsFromQtcliResponseData(data: unknown) {
  const type = _.get(data, 'type', '') as string;
  const files = _.get(data, 'files', []) as string[];
  const filesDir = _.get(data, 'filesDir', '') as string;
  if (type.length === 0 || filesDir.length === 0) {
    return;
  }

  if (type === 'project') {
    void openUri(vscode.Uri.file(path.normalize(filesDir)));
  } else {
    void openFilesUnder(path.normalize(filesDir), files);
  }
}

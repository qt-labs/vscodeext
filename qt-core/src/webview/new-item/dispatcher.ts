// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import _ from 'lodash';
import * as path from 'path';
import * as vscode from 'vscode';

import { createLogger, normalizeDriveLetter, telemetry } from 'qt-lib';
import * as texts from '@/texts';
import { QtcliRestClient, QtcliRestError } from '@/qtcli/rest';
import { openFilesUnder, openUri } from '@/qtcli/common';
import { getNewProjectBaseDir, setDefaultProjectDir } from '@/qtcli/commands';
import { generateProjectConfigs } from '@/project-config-generator';
import { WebviewDispatcher } from '@/webview/dispatcher';
import { Command, CommandId } from '@/webview/shared/message';
import { GlobalStateManager } from '@/state';

const logger = createLogger('new-item-handler');

export class NewItemDispatcher extends WebviewDispatcher {
  private readonly _qtcliRest: QtcliRestClient;
  private _uiConfigs: unknown = {};

  public constructor(
    qtcliSocketName: string,
    panel: vscode.WebviewPanel,
    private readonly _extensionContext: vscode.ExtensionContext
  ) {
    super('new-item', panel);
    this.setHandlers([
      [CommandId.UiClosed, this.onUiClosed],
      [CommandId.UiItemCreationRequested, this.onUiItemCreationRequested],
      [CommandId.UiHasError, this.onUiHasError],
      [CommandId.UiCheckIfQtcliReady, this.onUiCheckIfQtcliReady],
      [CommandId.UiGetConfigs, this.onUiGetConfigs],
      [CommandId.UiGetAllPresets, this.onUiGetAllPresets],
      [CommandId.UiGetPresetById, this.onUiGetPresetById],
      [CommandId.UiValidateInputs, this.onUiValidateInputs],
      [CommandId.UiManageCustomPreset, this.onUiManageCustomPreset],
      [CommandId.UiSelectWorkingDir, this.onUiSelectWorkingDir],
      [CommandId.UiSaveOpenInPreference, this.onUiSaveOpenInPreference]
    ]);

    this._qtcliRest = new QtcliRestClient(qtcliSocketName);
  }

  public override dispose() {
    this._qtcliRest.dispose();
    super.dispose();
  }

  public setUiConfigs(c: unknown) {
    this._uiConfigs = c;
  }

  private readonly onUiClosed = () => {
    this.context.panel.dispose();
  };

  private readonly onUiItemCreationRequested = async (cmd: Command) => {
    try {
      const data = await this._qtcliRest.call({
        method: 'post',
        url: '/items',
        data: cmd.payload
      });

      const openIn = _.get(cmd.payload, 'openIn', 'addToWorkspace') as
        | 'addToWorkspace'
        | 'newWindow';
      openItemsFromQtcliResponseData(data, openIn);

      const type = _.get(cmd.payload, 'type', '') as string;
      const save = _.get(cmd.payload, 'saveProjectDir', false) as boolean;
      const workingDir = _.get(data, 'workingDir', '') as string;

      if (type === 'project' && save && workingDir.length !== 0) {
        await setDefaultProjectDir(workingDir);
      }

      // Save the openIn preference for projects
      if (type === 'project') {
        const globalState = new GlobalStateManager(this._extensionContext);
        await globalState.setNewProjectOpenIn(openIn);
      }

      telemetry.sendEvent('Wizard:createItem', {
        type,
        template: String(_.get(cmd.payload, 'template', '')).trim()
      });

      this.context.panel.dispose();
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
      this.channel.replyData(cmd, data);
    } catch {
      await vscode.window.showErrorMessage(texts.newItem.errorQtCliNotReady);
    }
  };

  private readonly onUiGetConfigs = (cmd: Command) => {
    this.channel.replyData(cmd, this._uiConfigs);
  };

  private readonly onUiGetAllPresets = async (cmd: Command) => {
    const data = await this._qtcliRest.get('/presets', { type: cmd.payload });
    this.channel.replyData(cmd, data);
  };

  private readonly onUiGetPresetById = async (cmd: Command) => {
    const id = _.toString(cmd.payload);
    const data = await this._qtcliRest.get(`/presets/${id}`);
    this.channel.replyData(cmd, data);
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
          this.channel.replyData(cmd, data);
          break;
        }

        case 'rename': {
          await this._qtcliRest.post('/presets', cmd.payload);
          await this._qtcliRest.delete(`/presets/${presetId}`);
          this.channel.replyData(cmd, cmd.payload);
          break;
        }

        case 'update': {
          await this._qtcliRest.patch(`/presets/${presetId}`, cmd.payload);
          this.channel.replyData(cmd, cmd.payload);
          break;
        }

        case 'delete': {
          const data = await this._qtcliRest.delete(`/presets/${presetId}`);
          this.channel.replyData(cmd, data);
          break;
        }
      }
    } catch (e) {
      if (e instanceof QtcliRestError) {
        await vscode.window.showErrorMessage(e.toString());
        this.channel.replyErrorFrom(cmd, e.message, e.details);
      }
    }
  };

  private readonly onUiValidateInputs = async (cmd: Command) => {
    try {
      const data = await this._qtcliRest.post('/items/validate', cmd.payload);
      this.channel.replyData(cmd, data);
    } catch (e) {
      if (e instanceof QtcliRestError) {
        this.channel.replyErrorFrom(cmd, e.message, e.details);
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
      const folder = normalizeDriveLetter(folderUri[0]?.fsPath ?? '');
      this.channel.replyData(cmd, folder);
    }
  };

  private readonly onUiSaveOpenInPreference = async (cmd: Command) => {
    const value = cmd.payload as 'addToWorkspace' | 'newWindow';
    const globalState = new GlobalStateManager(this._extensionContext);
    await globalState.setNewProjectOpenIn(value);
  };
}

// helpers
function openItemsFromQtcliResponseData(
  data: unknown,
  openIn = 'addToWorkspace'
) {
  const type = _.get(data, 'type', '') as string;
  const files = _.get(data, 'files', []) as string[];
  const filesDir = _.get(data, 'filesDir', '') as string;
  if (type.length === 0 || filesDir.length === 0) {
    return;
  }

  if (type === 'project') {
    generateProjectConfigs(path.normalize(filesDir));
    const uri = vscode.Uri.file(path.normalize(filesDir));
    if (openIn === 'newWindow') {
      void vscode.commands.executeCommand('vscode.openFolder', uri, true);
    } else {
      void openUri(uri);
    }
  } else {
    void openFilesUnder(path.normalize(filesDir), files);
  }
}

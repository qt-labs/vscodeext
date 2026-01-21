// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { telemetry } from 'qt-lib';
import { EXTENSION_ID } from '@/constants.js';
import { DecisionCode, fetchAssetAndDecide, Qmlls } from '@/qmlls.mjs';

export function registerDownloadQmllsCommand() {
  return vscode.commands.registerCommand(
    `${EXTENSION_ID}.downloadQmlls`,
    async () => {
      telemetry.sendAction('downloadQmlls');
      const decision = await fetchAssetAndDecide({ doNotAsk: true });

      switch (decision.code) {
        case DecisionCode.NeedToUpdate:
          if (decision.asset) {
            try {
              await Qmlls.install(decision.asset);
              void vscode.window.showInformationMessage(
                'QML Language Server installed successfully.'
              );
            } catch (error) {
              void vscode.window.showErrorMessage(
                `Failed to install QML Language Server: ${error instanceof Error ? error.message : String(error)}`
              );
            }
          }
          break;

        default:
          break;
      }
    }
  );
}

// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { telemetry } from 'qt-lib';
import { EXTENSION_ID } from '@/constants';
import { DecisionCode, fetchAssetAndDecide, Qmlls } from '@/qmlls';

export function registerDownloadQmllsCommand() {
  return vscode.commands.registerCommand(
    `${EXTENSION_ID}.downloadQmlls`,
    async () => {
      telemetry.sendAction('downloadQmlls');
      const decision = await fetchAssetAndDecide({ doNotAsk: true });

      switch (decision.code) {
        case DecisionCode.NeedToUpdate:
        case DecisionCode.AlreadyUpToDate:
          if (decision.asset) {
            await Qmlls.install(decision.asset);
          }
          break;

        default:
          break;
      }
    }
  );
}

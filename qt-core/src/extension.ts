// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { createLogger, initLogger } from 'qt-lib';
import { CoreApiImpl } from '@/api';
import { registerDocumentationCommands } from '@/online-docs';
import { registerSetRecommendedSettingsCommand } from '@/recommended-settings';
import { EXTENSION_ID } from '@/constants';

const logger = createLogger('extension');

export function activate(context: vscode.ExtensionContext) {
  initLogger(EXTENSION_ID);
  logger.info(`Activating ${context.extension.id}`);
  context.subscriptions.push(...registerDocumentationCommands());
  context.subscriptions.push(registerSetRecommendedSettingsCommand());
  context.subscriptions.push(
    vscode.commands.registerCommand(`${EXTENSION_ID}.openSettings`, () => {
      void vscode.commands.executeCommand(
        'workbench.action.openSettings',
        '@ext:theqtcompany.qt-official @ext:theqtcompany.qt-ui @ext:theqtcompany.qt-core'
      );
    })
  );
  const coreApi = new CoreApiImpl();
  return coreApi;
}

export function deactivate() {
  logger.info(`Deactivating ${EXTENSION_ID}`);
}

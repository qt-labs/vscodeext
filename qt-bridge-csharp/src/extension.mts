// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import { createLogger, initLogger, telemetry } from 'qt-lib';
import { EXTENSION_ID, LOG_NAME } from '@/constants.js';
import { QtBridgeCSharpApi } from '@/api.mjs';

const logger = createLogger('extension');

export async function activate(context: vscode.ExtensionContext) {
  initLogger(LOG_NAME);
  telemetry.activate(context);
  logger.info(`Activating ${EXTENSION_ID}`);
  telemetry.sendEvent('activated');

  const api = new QtBridgeCSharpApi();
  context.subscriptions.push(
    api,
    vscode.commands.registerCommand(
      `${EXTENSION_ID}.selectQmlMetadata`,
      async () => api.selectMetadata()
    )
  );
  await api.initialize(context.workspaceState);
  return api;
}

export function deactivate() {
  logger.info(`Deactivating ${EXTENSION_ID}`);
  telemetry.dispose();
}

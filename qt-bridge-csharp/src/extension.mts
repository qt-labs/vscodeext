// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import { createLogger, initLogger, telemetry } from 'qt-lib';
import { EXTENSION_ID, LOG_NAME } from '@/constants.js';
import { QtBridgeCSharpApi } from '@/api.mjs';
import { collectPreviewStagingGarbage } from '@/project.mjs';

const logger = createLogger('extension');

// Sweep staging directories left behind by extension hosts that never got to
// clean up. Best-effort and off the activation path: a failure here must not
// keep the extension from activating.
function sweepPreviewStagingDirectories() {
  void collectPreviewStagingGarbage()
    .then((result) => {
      if (result.removed.length > 0 || result.skipped.length > 0) {
        logger.info(
          `Removed ${String(result.removed.length)} stale preview staging ` +
            `directories, skipped ${String(result.skipped.length)}`
        );
      }
    })
    .catch((error: unknown) => {
      logger.warn(`Preview staging cleanup failed: ${String(error)}`);
    });
}

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
  sweepPreviewStagingDirectories();
  return api;
}

export function deactivate() {
  logger.info(`Deactivating ${EXTENSION_ID}`);
  telemetry.dispose();
}

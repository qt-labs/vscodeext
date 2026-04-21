// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import {
  CoreAPI,
  getCoreApi,
  createLogger,
  initLogger,
  telemetry
} from 'qt-lib';
import { EXTENSION_ID } from '@/constants';
import {
  searchPackages,
  listInstalledPackages,
  installPackage,
  setInstallationPath
} from '@/commands';

const logger = createLogger('extension');

export let coreAPI: CoreAPI | undefined;

export async function activate(context: vscode.ExtensionContext) {
  initLogger(EXTENSION_ID);
  logger.info(`Activating ${context.extension.id}`);
  telemetry.activate(context);

  coreAPI = await getCoreApi();
  if (!coreAPI) {
    const msg = 'Failed to get CoreAPI';
    logger.error(msg);
    throw new Error(msg);
  }

  context.subscriptions.push(
    vscode.commands.registerCommand(
      `${EXTENSION_ID}.searchPackages`,
      searchPackages
    ),
    vscode.commands.registerCommand(
      `${EXTENSION_ID}.listInstalledPackages`,
      listInstalledPackages
    ),
    vscode.commands.registerCommand(
      `${EXTENSION_ID}.installPackage`,
      installPackage
    ),
    vscode.commands.registerCommand(
      `${EXTENSION_ID}.setInstallationPath`,
      setInstallationPath
    )
  );

  telemetry.sendEvent('activated');
  return {};
}

export function deactivate() {
  logger.info(`Deactivating ${EXTENSION_ID}`);
  telemetry.dispose();
}

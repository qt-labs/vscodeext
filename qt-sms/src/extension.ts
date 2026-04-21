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
import {
  registerAuthenticationProvider,
  AUTH_PROVIDER_ID
} from '@/auth-provider';

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

  const authProvider = registerAuthenticationProvider(context);

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
    ),
    vscode.commands.registerCommand(`${EXTENSION_ID}.login`, async () => {
      try {
        await vscode.authentication.getSession(
          AUTH_PROVIDER_ID,
          [AUTH_PROVIDER_ID],
          {
            createIfNone: true
          }
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg !== 'Login cancelled') {
          void vscode.window.showErrorMessage(
            `Qt Account login failed: ${msg}`
          );
        }
      }
    }),
    vscode.commands.registerCommand(`${EXTENSION_ID}.logout`, async () => {
      const sessions = await authProvider.getSessions();
      for (const session of sessions) {
        await authProvider.removeSession(session.id);
      }
      void vscode.window.showInformationMessage('Logged out of Qt Account');
    })
  );

  telemetry.sendEvent('activated');
  return {};
}

export function deactivate() {
  logger.info(`Deactivating ${EXTENSION_ID}`);
  telemetry.dispose();
}

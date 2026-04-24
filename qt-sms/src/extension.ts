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
import { EXTENSION_ID, CONF_INSTALLATION_PATH } from '@/constants';
import {
  searchPackages,
  listInstalledPackages,
  installPackage,
  setInstallationPath,
  onInstallationPathChanged
} from '@/commands';
import { disconnect } from '@/service-connection';
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

  // Track login state via VS Code context key
  const setLoggedIn = (value: boolean) =>
    void vscode.commands.executeCommand(
      'setContext',
      `${EXTENSION_ID}.isLoggedIn`,
      value
    );

  // Check login status at startup
  const sessions = await authProvider.getSessions();
  if (sessions.length > 0 && sessions[0]) {
    logger.info(`Already logged in as ${sessions[0].account.label}`);
    setLoggedIn(true);
  } else {
    logger.info('No active session, attempting to renew stored credentials');
    const renewed = await authProvider.tryRenewSession();
    if (renewed) {
      logger.info(`Session renewed for ${renewed.account.label}`);
      setLoggedIn(true);
    } else {
      logger.info('No stored credentials found, user is not logged in');
      setLoggedIn(false);
    }
  }

  // Keep context key in sync when sessions change
  context.subscriptions.push(
    authProvider.onDidChangeSessions((e) => {
      if (e.added && e.added.length > 0) {
        setLoggedIn(true);
      } else if (e.removed && e.removed.length > 0) {
        setLoggedIn(false);
      }
    })
  );

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
      const ss = await authProvider.getSessions();
      for (const s of ss) {
        await authProvider.removeSession(s.id);
      }
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(`${EXTENSION_ID}.${CONF_INSTALLATION_PATH}`)) {
        void onInstallationPathChanged();
      }
    })
  );

  telemetry.sendEvent('activated');
  return {};
}

export function deactivate() {
  logger.info(`Deactivating ${EXTENSION_ID}`);
  disconnect();
  telemetry.dispose();
}

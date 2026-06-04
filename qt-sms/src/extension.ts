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
  installPackage,
  setInstallationPath,
  onInstallationPathChanged,
  login,
  logout,
  resetTestState,
  setExtensionContext,
  setAuthProvider,
  syncInstalledPackages
} from '@/commands';
import { disconnect } from '@/service-connection';
import { registerAuthenticationProvider } from '@/auth-provider';
import { AccountViewProvider } from '@/account-view';
import { initSurvey, disposeSurvey } from '@/survey';

import { installBootstrap } from '@/bootstrap';

const logger = createLogger('extension');

const VERSIONED_EXTENSIONS: string[] = [];
const REQUIRED_EXTENSIONS = ['theqtcompany.qt-cpp-pack'];

async function ensureCoreVersion(): Promise<void> {
  const ext = vscode.extensions.getExtension('theqtcompany.qt-core');
  if (ext) {
    return;
  }
  logger.info('theqtcompany.qt-core not found, installing prerelease version');
  await vscode.commands.executeCommand(
    'workbench.extensions.installExtension',
    'theqtcompany.qt-core',
    { installPreReleaseVersion: true }
  );
}

function areRequiredExtensionsInstalled(requiredVersion: string): boolean {
  return REQUIRED_EXTENSIONS.every((extId) => {
    const ext = vscode.extensions.getExtension(extId);
    if (!ext) {
      return false;
    }
    if (VERSIONED_EXTENSIONS.includes(extId)) {
      const installedVersion = String(
        (ext.packageJSON as Record<string, unknown>).version
      );
      return installedVersion === requiredVersion;
    }
    return true;
  });
}

async function updateRequiredExtensionsContext(
  requiredVersion: string
): Promise<void> {
  await vscode.commands.executeCommand(
    'setContext',
    `${EXTENSION_ID}.requiredExtensionsInstalled`,
    areRequiredExtensionsInstalled(requiredVersion)
  );
}

async function installRequiredExtensions(
  context: vscode.ExtensionContext
): Promise<void> {
  const requiredVersion = String(
    (context.extension.packageJSON as Record<string, unknown>).version
  );

  for (const extId of REQUIRED_EXTENSIONS) {
    const ext = vscode.extensions.getExtension(extId);
    if (ext) {
      continue;
    }
    logger.info(`Installing required extension: ${extId}`);
    await vscode.commands.executeCommand(
      'workbench.extensions.installExtension',
      extId
    );
  }
  logger.info('Installing prerelease theqtcompany.qt-core');
  await vscode.commands.executeCommand(
    'workbench.extensions.installExtension',
    'theqtcompany.qt-core',
    { installPreReleaseVersion: true }
  );
  await updateRequiredExtensionsContext(requiredVersion);
  if (areRequiredExtensionsInstalled(requiredVersion)) {
    void vscode.window.showInformationMessage(
      'Required extensions installed successfully.'
    );
  }
}

export let coreAPI: CoreAPI | undefined;

export async function activate(context: vscode.ExtensionContext) {
  initLogger(EXTENSION_ID);
  logger.info(`Activating ${context.extension.id}`);
  telemetry.activate(context);

  setExtensionContext(context);

  await ensureCoreVersion();

  const requiredVersion = '1.15.0';
  await updateRequiredExtensionsContext(requiredVersion);

  // Re-check when extensions are installed/uninstalled
  context.subscriptions.push(
    vscode.extensions.onDidChange(
      () => void updateRequiredExtensionsContext(requiredVersion)
    )
  );

  void installBootstrap();

  coreAPI = await getCoreApi();
  if (!coreAPI) {
    const msg = 'Failed to get CoreAPI';
    logger.error(msg);
    throw new Error(msg);
  }

  const authProvider = registerAuthenticationProvider(context);
  setAuthProvider(authProvider);

  // Activity bar account view
  const accountViewProvider = new AccountViewProvider();
  const accountTreeView = vscode.window.createTreeView(
    `${EXTENSION_ID}.accountView`,
    { treeDataProvider: accountViewProvider }
  );
  accountViewProvider.setTreeView(accountTreeView);
  context.subscriptions.push(accountTreeView);

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
    accountViewProvider.setSession(sessions[0]);
    syncInstalledPackages();
  } else {
    logger.info('No active session, attempting to renew stored credentials');
    const renewed = await authProvider.tryRenewSession();
    if (renewed) {
      logger.info(`Session renewed for ${renewed.account.label}`);
      setLoggedIn(true);
      const renewedSessions = await authProvider.getSessions();
      accountViewProvider.setSession(renewedSessions[0]);
      syncInstalledPackages();
    } else {
      logger.info('No stored credentials found, user is not logged in');
      setLoggedIn(false);
      accountViewProvider.setSession(undefined);
    }
  }

  // Keep context key and account view in sync when sessions change
  context.subscriptions.push(
    authProvider.onDidChangeSessions(async (e) => {
      logger.info('Authentication sessions changed');
      if (e.added && e.added.length > 0) {
        setLoggedIn(true);
        const currentSessions = await authProvider.getSessions();
        accountViewProvider.setSession(currentSessions[0]);
        syncInstalledPackages();
      } else if (e.removed && e.removed.length > 0) {
        setLoggedIn(false);
        accountViewProvider.setSession(undefined);
      } else if (e.changed && e.changed.length > 0) {
        const currentSessions = await authProvider.getSessions();
        accountViewProvider.setSession(currentSessions[0]);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      `${EXTENSION_ID}.searchPackages`,
      searchPackages
    ),
    vscode.commands.registerCommand(
      `${EXTENSION_ID}.installPackage`,
      installPackage
    ),
    vscode.commands.registerCommand(
      `${EXTENSION_ID}.setInstallationPath`,
      setInstallationPath
    ),
    vscode.commands.registerCommand(`${EXTENSION_ID}.login`, async () =>
      login(authProvider)
    ),
    vscode.commands.registerCommand(`${EXTENSION_ID}.logout`, async () =>
      logout(authProvider)
    ),
    vscode.commands.registerCommand(
      `${EXTENSION_ID}.installRequiredExtensions`,
      async () => installRequiredExtensions(context)
    ),
    vscode.commands.registerCommand(
      `${EXTENSION_ID}.openWalkthrough`,
      () =>
        void vscode.commands.executeCommand(
          'workbench.action.openWalkthrough',
          `theqtcompany.${EXTENSION_ID}#${EXTENSION_ID}.getStarted`,
          false
        )
    ),
    vscode.commands.registerCommand(
      `${EXTENSION_ID}.resetTestState`,
      resetTestState
    ),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(`${EXTENSION_ID}.${CONF_INSTALLATION_PATH}`)) {
        void onInstallationPathChanged();
      }
    })
  );

  // Initialize survey popup (shows after 30 minutes)
  initSurvey(context);

  telemetry.sendEvent('activated');

  return {};
}

export function deactivate() {
  logger.info(`Deactivating ${EXTENSION_ID}`);
  disposeSurvey();
  disconnect();
  telemetry.dispose();
}

// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import {
  CoreAPI,
  getCoreApi,
  createLogger,
  initLogger,
  telemetry,
  compareVersions
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
import {
  showWalkthroughPanel,
  getStepCompletion,
  registerWalkthroughSerializer,
  refreshWalkthrough,
  refreshLatestFrameworkState
} from '@/walkthrough-panel';

import { installBootstrap } from '@/bootstrap';
import { watchInstalledPackagesOnDisk } from '@/installed-packages-store';
import { publishQtToolsPaths, watchQtToolsOnDisk } from '@/qt-tools-store';

const logger = createLogger('extension');

const VERSIONED_EXTENSIONS: string[] = [];
const QT_PRERELEASE_EXTENSIONS = [
  'theqtcompany.qt-core',
  'theqtcompany.qt-cpp',
  'theqtcompany.qt-qml',
  'theqtcompany.qt-ui'
];
const OTHER_REQUIRED_EXTENSIONS = [
  'theqtcompany.qt-cpp-pack',
  'ms-vscode.cmake-tools',
  'ms-vscode.cpptools'
];

const MIN_CMAKE_TOOLS_VERSION = '1.22.16';
const REQUIRED_EXTENSIONS = [
  ...QT_PRERELEASE_EXTENSIONS,
  ...OTHER_REQUIRED_EXTENSIONS
];

async function ensureCoreVersion(): Promise<void> {
  const ext = vscode.extensions.getExtension('theqtcompany.qt-core');
  if (ext) {
    const packageJSON = ext.packageJSON as Record<string, unknown>;
    const installedVersion = String(packageJSON.version);

    if (compareVersions(installedVersion, requiredVersion) >= 0) {
      logger.info(
        `Installed Qt Core extension ${installedVersion} is at least ` +
          `${requiredVersion}, keeping it`
      );
      return;
    }
  }

  logger.info('Installing pre-release Qt Core extension');
  await vscode.commands.executeCommand(
    'workbench.extensions.installExtension',
    'theqtcompany.qt-core',
    { installPreReleaseVersion: true }
  );
  await vscode.commands.executeCommand('workbench.action.reloadWindow');
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

export function getRequiredExtensionsContext() {
  return areRequiredExtensionsInstalled(requiredVersion);
}

async function installRequiredExtensions(
  context: vscode.ExtensionContext
): Promise<void> {
  const requiredVersion = String(
    (context.extension.packageJSON as Record<string, unknown>).version
  );

  for (const extId of QT_PRERELEASE_EXTENSIONS) {
    logger.info(`Installing pre-release extension: ${extId}`);
    await vscode.commands.executeCommand(
      'workbench.extensions.installExtension',
      extId,
      { installPreReleaseVersion: true }
    );
  }
  for (const extId of OTHER_REQUIRED_EXTENSIONS) {
    const ext = vscode.extensions.getExtension(extId);
    if (ext) {
      if (extId === 'ms-vscode.cmake-tools') {
        const version = String(
          (ext.packageJSON as Record<string, unknown>).version
        );
        if (compareVersions(version, MIN_CMAKE_TOOLS_VERSION) < 0) {
          logger.info(
            `Updating ${extId} from ${version} to >= ${MIN_CMAKE_TOOLS_VERSION}`
          );
          await vscode.commands.executeCommand(
            'workbench.extensions.installExtension',
            extId
          );
        }
      }
      continue;
    }
    logger.info(`Installing required extension: ${extId}`);
    await vscode.commands.executeCommand(
      'workbench.extensions.installExtension',
      extId
    );
  }
  await updateRequiredExtensionsContext(requiredVersion);
  if (areRequiredExtensionsInstalled(requiredVersion)) {
    void vscode.window.showInformationMessage(
      'Required extensions installed successfully.'
    );
  }
}

export let coreAPI: CoreAPI | undefined;
const requiredVersion = '1.15.1';

let loggedIn = false;
function setLoggedIn(value: boolean) {
  loggedIn = value;
  void vscode.commands.executeCommand(
    'setContext',
    `${EXTENSION_ID}.isLoggedIn`,
    value
  );
}

export function getLoggedIn() {
  return loggedIn;
}

export async function activate(context: vscode.ExtensionContext) {
  initLogger(EXTENSION_ID);
  logger.info(`Activating ${context.extension.id}`);
  telemetry.activate(context);

  setExtensionContext(context);

  await ensureCoreVersion();

  await updateRequiredExtensionsContext(requiredVersion);

  // Re-check when extensions are installed/uninstalled
  context.subscriptions.push(
    vscode.extensions.onDidChange(() => {
      void updateRequiredExtensionsContext(requiredVersion);
      // Re-sync both directions: required extensions may have been installed
      // or uninstalled, so the step can go forward or backward.
      refreshWalkthrough();
    })
  );

  // Re-sync the walkthrough when Qt versions appear/disappear in the
  // installation root on disk (installs/uninstalls outside the extension).
  // Recompute both the step status and the cached "latest installed" gate, so
  // removing the newest (or only) version re-enables "Get latest Qt Framework".
  watchInstalledPackagesOnDisk(context, () => {
    refreshWalkthrough();
    void refreshLatestFrameworkState();
  });

  void installBootstrap();

  coreAPI = await getCoreApi();
  if (!coreAPI) {
    const msg = 'Failed to get CoreAPI';
    logger.error(msg);
    throw new Error(msg);
  }

  // Detect the bundled build tools (CMake, Ninja) and inform qt-core/qt-cpp via
  // CoreAPI. Done at activation because the installation root may have changed
  // (e.g. via QtCreator) while qt-sm was not running. Also keep watching the
  // Tools/ directory so external installs/uninstalls propagate live.
  publishQtToolsPaths();
  watchQtToolsOnDisk(context, publishQtToolsPaths);

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
        // Re-render so the sign-in step's button is recomputed as disabled.
        refreshWalkthrough();
        const currentSessions = await authProvider.getSessions();
        accountViewProvider.setSession(currentSessions[0]);
        syncInstalledPackages();
      } else if (e.removed && e.removed.length > 0) {
        setLoggedIn(false);
        accountViewProvider.setSession(undefined);
        // Signed out: the sign-in step (and everything gated behind it)
        // reverts, so re-render the walkthrough.
        refreshWalkthrough();
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
    vscode.commands.registerCommand(`${EXTENSION_ID}.openWalkthrough`, () => {
      const completion = getStepCompletion(
        context,
        loggedIn,
        areRequiredExtensionsInstalled(requiredVersion)
      );
      // print completion state for testing purposes
      logger.info(
        `Walkthrough completion state: ${JSON.stringify(completion)}`
      );
      showWalkthroughPanel(context, completion);
    }),
    vscode.commands.registerCommand(
      `${EXTENSION_ID}.resetTestState`,
      resetTestState
    ),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(`${EXTENSION_ID}.${CONF_INSTALLATION_PATH}`)) {
        void onInstallationPathChanged();
        // The new root may contain a different set of installed Qt versions,
        // so the framework step can go forward or backward.
        refreshWalkthrough();
        // The new root may also bundle different build tools; re-detect and
        // re-publish them to qt-core/qt-cpp.
        publishQtToolsPaths();
      }
    }),
    // Restore the walkthrough tab after a window reload.
    registerWalkthroughSerializer(context)
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

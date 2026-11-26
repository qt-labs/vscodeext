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
import {
  EXTENSION_ID,
  CONF_INSTALLATION_PATH,
  RESET_PASSWORD_URL,
  TELEMETRY_STATEMENT_URL,
  TROUBLESHOOT_URL
} from '@/constants';
import {
  searchPackages,
  installPackage,
  removePackage,
  setInstallationPath,
  onInstallationPathChanged,
  login,
  loginWithPersonalAccessToken,
  logout,
  resetTestState,
  setExtensionContext,
  setAuthProvider,
  syncInstalledPackages
} from '@/commands';
import { disconnect, setUsageDataConsent } from '@/service-connection';
import {
  registerAuthenticationProvider,
  type QtAccountAuthenticationProvider,
  type SignInState
} from '@/auth-provider';
import { registerAccountView } from '@/account-view';
import { initSurvey, disposeSurvey, shareFeedback } from '@/survey';
import {
  showWalkthroughPanel,
  getStepCompletion,
  registerWalkthroughSerializer,
  refreshWalkthrough,
  refreshLatestFrameworkState,
  markSignedOut,
  getUsageDataOptIn
} from '@/walkthrough-panel';

import { installBootstrap } from '@/bootstrap';
import {
  onDidChangeInstalledVersions,
  watchInstalledPackagesOnDisk
} from '@/installed-packages-store';
import {
  loadInstalledPackagesAfter,
  refreshInstalledPackages,
  registerInstalledPackagesView,
  scheduleInstalledPackagesRefresh
} from '@/installed-packages-view';
import { publishQtToolsPaths, watchQtToolsOnDisk } from '@/qt-tools-store';
import { initLatestFrameworkState } from '@/latest-framework';

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

// The Qt extensions that use what this extension shares through CoreAPI,
// such as the MinGW toolchains. They must be at least `requiredVersion`.
const MIN_VERSION_EXTENSIONS = ['theqtcompany.qt-core', 'theqtcompany.qt-cpp'];

function isOlderThanRequired(extId: string): boolean {
  const ext = vscode.extensions.getExtension(extId);
  if (!ext) {
    return false;
  }
  const installedVersion = String(
    (ext.packageJSON as Record<string, unknown>).version
  );
  return compareVersions(installedVersion, requiredVersion) < 0;
}

// Remembers which extensions a pre-release install was already tried for
// with the current `requiredVersion`. When the Marketplace pre-release is
// still older, installing it again and reloading would never end.
function installAttemptKey(extId: string): string {
  return `${EXTENSION_ID}.preReleaseInstallAttempt.${extId}`;
}

async function installPreRelease(
  context: vscode.ExtensionContext,
  extId: string
): Promise<void> {
  await vscode.commands.executeCommand(
    'workbench.extensions.installExtension',
    extId,
    { installPreReleaseVersion: true }
  );
  await context.globalState.update(installAttemptKey(extId), requiredVersion);
}

/**
 * Installs the pre-release of a Qt extension that is older than
 * `requiredVersion`, or that is missing when `installIfMissing` is set.
 * Returns whether it installed one, which takes a window reload to load.
 */
async function ensureExtensionVersion(
  context: vscode.ExtensionContext,
  extId: string,
  name: string,
  installIfMissing: boolean
): Promise<boolean> {
  const ext = vscode.extensions.getExtension(extId);
  if (ext) {
    const installedVersion = String(
      (ext.packageJSON as Record<string, unknown>).version
    );
    if (compareVersions(installedVersion, requiredVersion) >= 0) {
      logger.info(
        `Installed ${name} extension ${installedVersion} is at least ` +
          `${requiredVersion}, keeping it`
      );
      return false;
    }
    if (context.globalState.get(installAttemptKey(extId)) === requiredVersion) {
      logger.warn(
        `${name} extension ${installedVersion} is still older than ` +
          `${requiredVersion} after installing its pre-release, ` +
          'not trying again'
      );
      return false;
    }
  } else if (!installIfMissing) {
    return false;
  }

  logger.info(`Installing pre-release ${name} extension`);
  await installPreRelease(context, extId);
  return true;
}

/**
 * Makes sure that the Qt extensions in `MIN_VERSION_EXTENSIONS` are at least
 * `requiredVersion`.
 */
async function ensureRequiredVersions(
  context: vscode.ExtensionContext
): Promise<void> {
  const coreInstalled = await ensureExtensionVersion(
    context,
    'theqtcompany.qt-core',
    'Qt Core',
    true
  );
  // The walkthrough installs a missing Qt C++, so it is left to it here.
  const cppInstalled = await ensureExtensionVersion(
    context,
    'theqtcompany.qt-cpp',
    'Qt C++',
    false
  );
  if (coreInstalled || cppInstalled) {
    await vscode.commands.executeCommand('workbench.action.reloadWindow');
  }
}

function areRequiredExtensionsInstalled(requiredVersion: string): boolean {
  return REQUIRED_EXTENSIONS.every((extId) => {
    const ext = vscode.extensions.getExtension(extId);
    if (!ext) {
      return false;
    }
    if (MIN_VERSION_EXTENSIONS.includes(extId) && isOlderThanRequired(extId)) {
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
    await installPreRelease(context, extId);
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
  // An extension that was already loaded keeps its old version until the
  // window reloads, and the walkthrough step stays open until then.
  if (MIN_VERSION_EXTENSIONS.some(isOlderThanRequired)) {
    const reload = 'Reload Window';
    const choice = await vscode.window.showInformationMessage(
      'Reload the window to load the updated Qt extensions.',
      reload
    );
    if (choice === reload) {
      await vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
    return;
  }
  if (areRequiredExtensionsInstalled(requiredVersion)) {
    void vscode.window.showInformationMessage(
      'Required extensions installed successfully.'
    );
  }
}

export let coreAPI: CoreAPI | undefined;
const requiredVersion = '1.17.2';

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

// Account label (email) of the active session, shown in the walkthrough's
// sign-in step. Kept in sync with the account view's session.
let accountLabel: string | undefined;

export function getAccountLabel(): string | undefined {
  return accountLabel;
}

// Progress of the browser sign-in, rendered by the walkthrough's sign-in step.
let authProviderRef: QtAccountAuthenticationProvider | undefined;

export function getSignInState(): SignInState {
  return authProviderRef?.signInState ?? { phase: 'idle' };
}

export async function activate(context: vscode.ExtensionContext) {
  initLogger(EXTENSION_ID);
  logger.info(`Activating ${context.extension.id}`);
  telemetry.activate(context);

  setExtensionContext(context);
  setUsageDataConsent(getUsageDataOptIn(context));
  initLatestFrameworkState(context);

  await ensureRequiredVersions(context);

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

  // The framework step of the walkthrough follows the Qt versions the
  // service lists: re-render it whenever a new answer changes them, for
  // example after an install or a removal.
  context.subscriptions.push(
    onDidChangeInstalledVersions(() => {
      refreshWalkthrough();
    })
  );

  // Qt versions appeared or disappeared in the installation root on disk
  // (installs/uninstalls outside the extension). Recompute the cached
  // "latest installed" gate, so removing the newest (or only) version
  // re-enables "Get latest Qt Framework".
  watchInstalledPackagesOnDisk(context, () => {
    void refreshLatestFrameworkState();
    // An install or removal made outside the extension changed the
    // service's records too; re-read them once the events settle.
    scheduleInstalledPackagesRefresh();
  });

  // The Installed Packages view lists what the service has installed. Start
  // the service now, without blocking the activation: the view shows a
  // progress bar until the service is connected and has answered.
  registerInstalledPackagesView(context);
  loadInstalledPackagesAfter(installBootstrap());

  coreAPI = await getCoreApi();
  if (!coreAPI) {
    const msg = 'Failed to get CoreAPI';
    logger.error(msg);
    throw new Error(msg);
  }

  // Detect the bundled build tools (CMake, Ninja) and inform qt-core/qt-cpp via
  // CoreAPI. Done at activation because the installation root may have changed
  // (e.g. via QtCreator) while qt-sm was not running. Also keep watching the
  // folders of the tools so external installs/uninstalls propagate live.
  publishQtToolsPaths();
  watchQtToolsOnDisk(context, publishQtToolsPaths);

  const authProvider = registerAuthenticationProvider(context);
  setAuthProvider(authProvider);
  authProviderRef = authProvider;

  // Activity bar account view
  const accountViewProvider = registerAccountView(context);

  // Update both the account view and the walkthrough's account label.
  const setAccountSession = (
    session: vscode.AuthenticationSession | undefined
  ) => {
    accountLabel = session?.account.label;
    accountViewProvider.setSession(session);
  };

  // Check login status at startup. The session comes from the shared Qt.ini,
  // so a login made by another Qt tool counts too.
  const sessions = await authProvider.getSessions();
  if (sessions.length > 0 && sessions[0]) {
    logger.info(`Already logged in as ${sessions[0].account.label}`);
    setLoggedIn(true);
    setAccountSession(sessions[0]);
  } else {
    logger.info('No stored credentials found, user is not logged in');
    setLoggedIn(false);
    setAccountSession(undefined);
  }

  // Keep context key and account view in sync when sessions change
  context.subscriptions.push(
    authProvider.onDidChangeSessions(async (e) => {
      logger.info('Authentication sessions changed');
      if (e.added && e.added.length > 0) {
        setLoggedIn(true);
        const currentSessions = await authProvider.getSessions();
        setAccountSession(currentSessions[0]);
        // Re-render (after the account label is known) so the sign-in step
        // shows the signed-in account and its Sign Out action.
        refreshWalkthrough();
      } else if (e.removed && e.removed.length > 0) {
        setLoggedIn(false);
        setAccountSession(undefined);
        // Signed out: the sign-in step (and everything gated behind it)
        // reverts, so re-render the walkthrough.
        markSignedOut(context);
      } else if (e.changed && e.changed.length > 0) {
        const currentSessions = await authProvider.getSessions();
        setAccountSession(currentSessions[0]);
      }
    }),
    // The sign-in card follows the browser hand-off (signing, stalled, failed).
    authProvider.onDidChangeSignInState(() => {
      refreshWalkthrough();
    })
  );

  // Renew an expired login in the background; a revoked one signs out.
  void authProvider.startBackgroundRenewal();

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
      `${EXTENSION_ID}.loginWithPersonalAccessToken`,
      async () => loginWithPersonalAccessToken(authProvider)
    ),
    vscode.commands.registerCommand(`${EXTENSION_ID}.reopenSignIn`, () => {
      authProvider.reopenBrowser();
    }),
    vscode.commands.registerCommand(`${EXTENSION_ID}.cancelSignIn`, () => {
      authProvider.cancelSignIn();
    }),
    vscode.commands.registerCommand(`${EXTENSION_ID}.openTroubleshooting`, () =>
      vscode.env.openExternal(vscode.Uri.parse(TROUBLESHOOT_URL))
    ),
    vscode.commands.registerCommand(
      `${EXTENSION_ID}.openTelemetryStatement`,
      () => vscode.env.openExternal(vscode.Uri.parse(TELEMETRY_STATEMENT_URL))
    ),
    vscode.commands.registerCommand(
      `${EXTENSION_ID}.shareFeedback`,
      shareFeedback
    ),
    vscode.commands.registerCommand(`${EXTENSION_ID}.resetPassword`, () =>
      vscode.env.openExternal(vscode.Uri.parse(RESET_PASSWORD_URL))
    ),
    // The browser sign-in opens on its Create Account tab, and the new
    // account is signed in when the browser comes back.
    vscode.commands.registerCommand(`${EXTENSION_ID}.createAccount`, async () =>
      login(authProvider, { signUp: true })
    ),
    vscode.commands.registerCommand(
      `${EXTENSION_ID}.removePackage`,
      removePackage
    ),
    vscode.commands.registerCommand(
      `${EXTENSION_ID}.refreshInstalledPackages`,
      async () => refreshInstalledPackages()
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
        // The new root may contain a different set of installed Qt versions.
        // The framework step goes forward or backward with the answer.
        syncInstalledPackages();
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

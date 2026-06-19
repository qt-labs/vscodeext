// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as https from 'https';
import * as os from 'os';
import * as path from 'path';

import {
  Packages,
  Settings,
  QtAccountStorage,
  IPC,
  type PackageData,
  type LicenseAnswer,
  type UserPrompt,
  type UserPromptReply,
  InstallState,
  UserPromptType,
  ProgressType
} from 'sms-api';

import {
  createLogger,
  resolveConfiguration,
  findQtPathsInInstallationPath,
  CORE_EXTENSION_ID,
  AdditionalQtPathsName,
  QtWorkspaceConfigMessage,
  CoreKey,
  type QtAdditionalPath
} from 'qt-lib';
import {
  EXTENSION_ID,
  CONF_INSTALLATION_PATH,
  CONF_RESET_LICENSE_AFTER_INSTALL,
  DEFAULT_BACKEND_URL
} from '@/constants';
import { ensureConnected, disconnect } from '@/service-connection';
import { coreAPI } from '@/extension';
import {
  AUTH_PROVIDER_ID,
  type QtAccountAuthenticationProvider
} from '@/auth-provider';
import { showLicenseAgreementPanel } from '@/license-panel';
import {
  isVersionInstalledOnDisk,
  isAnyVersionInstalledOnDisk
} from '@/installed-packages-store';
import { refreshWalkthrough } from '@/walkthrough-panel';
import { isInstalling, setInstalling } from '@/install-state';

const logger = createLogger('commands');

let extensionContext: vscode.ExtensionContext | undefined;
let authProviderInstance: QtAccountAuthenticationProvider | undefined;

export function setExtensionContext(ctx: vscode.ExtensionContext): void {
  extensionContext = ctx;
}

export function setAuthProvider(
  provider: QtAccountAuthenticationProvider
): void {
  authProviderInstance = provider;
}

function formatSize(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const index = Math.min(i, units.length - 1);
  const unit = units[index];
  if (unit === undefined) {
    return `${String(bytes)} B`;
  }
  return `${(bytes / Math.pow(1024, index)).toFixed(1)} ${unit}`;
}

function installStateLabel(state: InstallState): string {
  switch (state) {
    case InstallState.Installed:
      return '$(check) Installed';
    case InstallState.UpdateAvailable:
      return '$(arrow-up) Update available';
    case InstallState.Uninstalled:
      return '$(circle-outline) Not installed';
  }
}

async function handleUserPrompt(prompt: UserPrompt): Promise<UserPromptReply> {
  switch (prompt.type) {
    case UserPromptType.Choice: {
      const items = prompt.choices.map((choice) => ({
        label: choice,
        picked: choice === prompt.defaultAnswer
      }));
      const picked = await vscode.window.showQuickPick(items, {
        title: prompt.title,
        placeHolder: prompt.message || prompt.placeholderText
      });
      if (!picked) {
        return { kind: 'cancel' };
      }
      return { kind: 'choice', choice: picked.label };
    }
    case UserPromptType.Text: {
      const value = await vscode.window.showInputBox({
        title: prompt.title,
        prompt: prompt.message,
        value: prompt.defaultAnswer,
        placeHolder: prompt.placeholderText
      });
      if (value === undefined) {
        return { kind: 'cancel' };
      }
      return { kind: 'text', text: value };
    }
    case UserPromptType.DirectoryPath: {
      const dirOpts: vscode.OpenDialogOptions = {
        title: prompt.title || prompt.message,
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false
      };
      if (prompt.defaultAnswer) {
        dirOpts.defaultUri = vscode.Uri.file(prompt.defaultAnswer);
      }
      const dirUris = await vscode.window.showOpenDialog(dirOpts);
      const dirUri = dirUris?.[0];
      if (!dirUri) {
        return { kind: 'cancel' };
      }
      return { kind: 'text', text: dirUri.fsPath };
    }
    case UserPromptType.FilePath: {
      const fileOpts: vscode.OpenDialogOptions = {
        title: prompt.title || prompt.message,
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false
      };
      if (prompt.defaultAnswer) {
        fileOpts.defaultUri = vscode.Uri.file(prompt.defaultAnswer);
      }
      const fileUris = await vscode.window.showOpenDialog(fileOpts);
      const fileUri = fileUris?.[0];
      if (!fileUri) {
        return { kind: 'cancel' };
      }
      return { kind: 'text', text: fileUri.fsPath };
    }
  }
}

async function withService<T>(
  action: (packages: Packages) => Promise<T>
): Promise<T | undefined> {
  try {
    const session = await ensureConnected();
    const packages = new Packages(session);
    return await action(packages);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    void vscode.window.showErrorMessage(`Service error: ${msg}`);
    return undefined;
  }
}

export async function searchPackages(): Promise<void> {
  await withService(async (packages) => {
    const results = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Searching available packages...',
        cancellable: false
      },
      async () =>
        packages.searchAvailablePackages(
          { packagePresentation: 'monolith' },
          undefined,
          {
            onMessage: (info) => {
              logger.info(`searchAvailablePackages: ${info.message}`);
            },
            onPrompt: handleUserPrompt
          }
        )
    );

    if (results.length === 0) {
      void vscode.window.showInformationMessage('No packages found.');
      return;
    }

    // Build installed set from service + local store
    const installedKeys = new Set<string>();
    const installedList = await packages.listInstalledPackages(
      undefined,
      undefined,
      {
        onMessage: (info) => {
          logger.info(`searchPackages.listInstalled: ${info.message}`);
        },
        onPrompt: handleUserPrompt
      }
    );
    for (const pkg of installedList) {
      installedKeys.add(`${pkg.id}@${pkg.version}`);
    }
    for (const pkg of results) {
      if (pkg.installState === InstallState.Installed) {
        installedKeys.add(`${pkg.id}@${pkg.version}`);
      }
    }
    const isInstalled = (pkg: PackageData) =>
      installedKeys.has(`${pkg.id}@${pkg.version}`) ||
      isVersionInstalledOnDisk(pkg.version);

    const items = results.map((pkg: PackageData) => ({
      label: pkg.name || pkg.id,
      description: `${pkg.version} — ${isInstalled(pkg) ? '$(check) Installed' : installStateLabel(pkg.installState)}`,
      detail: `${pkg.description} (${formatSize(pkg.uncompressedSize)})`,
      pkg
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a package to view details',
      matchOnDescription: true,
      matchOnDetail: true
    });

    if (selected) {
      const installed = isInstalled(selected.pkg);
      const info = [
        `**${selected.pkg.name || selected.pkg.id}** v${selected.pkg.version}`,
        '',
        selected.pkg.description,
        '',
        `- **Author:** ${selected.pkg.author}`,
        `- **License:** ${selected.pkg.license}`,
        `- **Product:** ${selected.pkg.productName || selected.pkg.product}`,
        `- **Product ID:** ${selected.pkg.productId}`,
        `- **Product Version:** ${selected.pkg.productVersion}`,
        `- **Size:** ${formatSize(selected.pkg.uncompressedSize)}`,
        `- **Status:** ${installed ? 'Installed' : installStateLabel(selected.pkg.installState)}`
      ].join('\n');

      logger.info(`Package details:\n${info.replace(/\n/g, '\n> ')}`);

      const action = await vscode.window.showInformationMessage(
        info,
        { modal: true },
        ...(!installed ? ['Install'] : [])
      );

      if (action === 'Install') {
        await installPackageById(packages, selected.pkg);
      }
    }
  });
}

// export async function listInstalledPackages(): Promise<void> {
//   await withService(async (packages) => {
//     const results = await vscode.window.withProgress(
//       {
//         location: vscode.ProgressLocation.Notification,
//         title: 'Listing installed packages...',
//         cancellable: false
//       },
//       async () =>
//         packages.listInstalledPackages(undefined, undefined, {
//           onMessage: (info) => {
//             logger.info(`listInstalledPackages: ${info.message}`);
//           },
//           onPrompt: handleUserPrompt
//         })
//     );

//     if (results.length === 0) {
//       void vscode.window.showInformationMessage('No installed packages found.');
//       return;
//     }

//     const items = results.map((pkg: PackageData) => ({
//       label: pkg.name || pkg.id,
//       description: pkg.version,
//       detail: pkg.description
//     }));

//     await vscode.window.showQuickPick(items, {
//       placeHolder: 'Installed packages',
//       matchOnDescription: true,
//       matchOnDetail: true
//     });
//   });
// }

export function syncInstalledPackages() {
  const hasInstalled = isAnyVersionInstalledOnDisk();
  if (hasInstalled) {
    logger.info('Found installed Qt version(s) on disk');
    void vscode.commands.executeCommand(
      'setContext',
      `${EXTENSION_ID}.packageInstalled`,
      true
    );
  }
}

async function requireLogin(): Promise<boolean> {
  const sessions = await authProviderInstance?.getSessions();
  if (sessions && sessions.length > 0) {
    return true;
  }
  if (!authProviderInstance) {
    void vscode.window.showErrorMessage('Auth provider not available.');
    return false;
  }
  await login(authProviderInstance);
  const updated = await authProviderInstance.getSessions();
  return updated.length > 0;
}

export interface InstallPackageArgs {
  regex?: string;
  version?: string;
  product?: string;
}

export async function installPackage(args?: InstallPackageArgs): Promise<void> {
  await withService(async (packages) => {
    const results = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Fetching available packages...',
        cancellable: false
      },
      async () =>
        packages.searchAvailablePackages(
          { packagePresentation: 'monolith' },
          undefined,
          {
            onMessage: (info) => {
              logger.info(`searchAvailablePackages: ${info.message}`);
            },
            onPrompt: handleUserPrompt
          }
        )
    );

    let candidates = [...results];

    // Query installed packages from the service and update local store
    const installedList = await packages.listInstalledPackages(
      undefined,
      undefined,
      {
        onMessage: (info) => {
          logger.info(`installPackage.listInstalled: ${info.message}`);
        },
        onPrompt: handleUserPrompt
      }
    );

    // Build a set of installed package keys for fast lookup
    const installedKeys = new Set<string>();
    for (const pkg of installedList) {
      installedKeys.add(`${pkg.id}@${pkg.version}`);
    }
    // Also include packages the backend reports as installed
    for (const pkg of candidates) {
      if (pkg.installState === InstallState.Installed) {
        installedKeys.add(`${pkg.id}@${pkg.version}`);
      }
    }

    if (args?.product) {
      candidates = candidates.filter(
        (pkg: PackageData) => pkg.product === args.product
      );
    }

    if (args?.regex) {
      const re = new RegExp(args.regex, 'i');
      candidates = candidates.filter(
        (pkg: PackageData) => re.test(pkg.name) || re.test(pkg.id)
      );
    }

    if (candidates.length === 0) {
      void vscode.window.showInformationMessage(
        'No packages available for installation.'
      );
      return;
    }

    const uninstalledCandidates = candidates.filter(
      (pkg: PackageData) =>
        !installedKeys.has(`${pkg.id}@${pkg.version}`) &&
        !isVersionInstalledOnDisk(pkg.version)
    );

    if (args?.version === 'latest') {
      const sorted = [...uninstalledCandidates].sort((a, b) =>
        b.version.localeCompare(a.version, undefined, {
          numeric: true,
          sensitivity: 'base'
        })
      );
      const latest = sorted[0];
      if (latest) {
        await installPackageById(packages, latest);
        return;
      }
    }

    if (args?.version && args.version !== 'latest') {
      const match = uninstalledCandidates.find(
        (pkg: PackageData) => pkg.version === args.version
      );
      if (match) {
        await installPackageById(packages, match);
        return;
      }
      void vscode.window.showErrorMessage(
        `No package found with version "${args.version}".`
      );
      return;
    }

    if (uninstalledCandidates.length === 0) {
      void vscode.window.showInformationMessage(
        'No packages available for installation.'
      );
      return;
    }

    const items = uninstalledCandidates.map((pkg: PackageData) => ({
      label: pkg.name || pkg.id,
      description: pkg.version,
      detail: `${pkg.description} (${formatSize(pkg.uncompressedSize)})`,
      pkg
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a package to install',
      matchOnDescription: true,
      matchOnDetail: true
    });

    if (selected) {
      await installPackageById(packages, selected.pkg);
    }
  });
}

function platformArch(): string {
  switch (process.platform) {
    case 'darwin':
      return 'clang-universal';
    case 'linux':
      // TODO: Add support for other architectures
      return 'gcc-x86_64';
    case 'win32':
      // TODO: Add Windows support with appropriate architecture labels
      return 'msvc2022-x86_64';
    default:
      return 'unknown';
  }
}

function registerInstalledQtPaths(version: string): void {
  const smsConfig = vscode.workspace.getConfiguration(EXTENSION_ID);
  const rawInstallRoot = smsConfig.get<string>(CONF_INSTALLATION_PATH);
  if (!rawInstallRoot) {
    logger.warn('Installation path not set, skipping Qt registration');
    return;
  }
  const installRoot = resolveConfiguration(rawInstallRoot);

  if (!installRoot || !fs.existsSync(installRoot)) {
    logger.warn(
      'Installation path not set or does not exist, skipping Qt registration'
    );
    return;
  }

  // Folder structure: <installRoot>/QtFramework/<version>/<arch>/bin/qtpaths
  const arch = platformArch();
  const insPath = path.join(installRoot, 'QtFramework', version, arch);
  logger.info(`Looking for Qt installation in ${insPath}`);
  const qtpathsExe = findQtPathsInInstallationPath(insPath);
  if (!qtpathsExe) {
    logger.info(
      `No qtpaths found at QtFramework/${version}/${arch} in ${installRoot}`
    );
    return;
  }

  const coreConfig = vscode.workspace.getConfiguration(CORE_EXTENSION_ID);
  const existing = coreConfig.inspect<(string | object)[]>(
    AdditionalQtPathsName
  );
  const currentPaths: (string | object)[] = existing?.globalValue ?? [];
  const alreadyRegistered = currentPaths.some(
    (p) =>
      (typeof p === 'string' ? p : (p as { path: string }).path) === qtpathsExe
  );

  if (alreadyRegistered) {
    logger.info(`Qt installation already registered: ${qtpathsExe}`);
    return;
  }

  const updated = [...currentPaths, { path: qtpathsExe }];
  void coreConfig.update(
    AdditionalQtPathsName,
    updated,
    vscode.ConfigurationTarget.Global
  );
  logger.info(`Registered Qt installation: ${qtpathsExe}`);

  // Notify qt-cpp (via coreAPI) so it picks up the new kit immediately
  const allPaths: QtAdditionalPath[] = updated.map((p) =>
    typeof p === 'string' ? { path: p } : (p as QtAdditionalPath)
  );
  const message = new QtWorkspaceConfigMessage(CoreKey.GLOBAL_WORKSPACE);
  coreAPI?.setValue(
    CoreKey.GLOBAL_WORKSPACE,
    CoreKey.ADDITIONAL_QT_PATHS,
    allPaths
  );
  message.config.add(CoreKey.ADDITIONAL_QT_PATHS);
  logger.info(`Notifying coreAPI with message: ${message.toString()}`);
  coreAPI?.notify(message);
}

// Known license agreement IDs from the backend (alpha testing).
const KNOWN_LICENSE_AGREEMENT_IDS = [
  'Qt Enterprise License Agreement@1',
  'Mingw-w64 License Agreement@1',
  'Ninja License Agreement@1',
  'CMake License Agreement@1'
];

/**
 * Reset license agreement consents via the backend API so that the user is
 * prompted again on the next install. Only active when the
 * `qt-sm.resetLicenseBeforeInstall` setting is enabled.
 */
async function resetLicenseConsents(): Promise<void> {
  const config = vscode.workspace.getConfiguration(EXTENSION_ID);
  if (!config.get<boolean>(CONF_RESET_LICENSE_AFTER_INSTALL)) {
    return;
  }

  const sessions = await authProviderInstance?.getSessions();
  const jwt = sessions?.[0]?.accessToken;
  if (!jwt) {
    logger.warn('Cannot reset license consents: no active session');
    return;
  }

  const backendUrl = process.env.QIC_SERVICE_URL ?? DEFAULT_BACKEND_URL;
  logger.info(`backendUrl: ${backendUrl}`);

  for (const agreementId of KNOWN_LICENSE_AGREEMENT_IDS) {
    try {
      await postConsentReset(backendUrl, jwt, agreementId);
      logger.info(`Reset license consent for "${agreementId}"`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`Failed to reset consent for "${agreementId}": ${msg}`);
    }
  }
}

async function postConsentReset(
  backendUrl: string,
  jwt: string,
  agreementId: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ agreementId, accepted: false });
    const url = new URL('/api/v1/license-agreements/consent', backendUrl);

    const req = https.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          Authorization: `Bearer ${jwt}`
        }
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(
              new Error(`HTTP ${String(res.statusCode)}: ${data.slice(0, 200)}`)
            );
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function installPackageById(
  packages: Packages,
  pkg: PackageData
): Promise<void> {
  if (!(await requireLogin())) {
    return;
  }

  // Restrict to a single installation at a time.
  if (isInstalling()) {
    void vscode.window.showWarningMessage(
      'An installation is already in progress. Please wait for it to finish.'
    );
    return;
  }
  setInstalling(true);
  try {
    await installPackageByIdImpl(packages, pkg);
  } finally {
    setInstalling(false);
  }
}

async function installPackageByIdImpl(
  packages: Packages,
  pkg: PackageData
): Promise<void> {
  await resetLicenseConsents();

  const pkgRef = { id: pkg.id, version: pkg.version };

  // Fetch requirements (license agreements, unsatisfied rules).
  const preAnswers: LicenseAnswer[] = [];
  const requirements = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Checking requirements...',
      cancellable: false
    },
    async () =>
      packages.fetchRequirements([pkgRef], undefined, {
        onMessage: (info) => {
          logger.info(`fetchRequirements: ${info.message}`);
        },
        onPrompt: handleUserPrompt
      })
  );

  // Block only on non-resolvable rules (e.g. visibility restrictions).
  // Rules with conditionType "la_accepted" are resolved by the LA flow below.
  const hardBlockers = requirements.unsatisfiedRules.filter(
    (r) => !r.isResolvableByUser
  );
  if (hardBlockers.length > 0) {
    const messages = hardBlockers.map((r) => r.userMessage);
    void vscode.window.showErrorMessage(
      `Cannot install ${pkg.name || pkg.id}: ${messages.join('; ')}`
    );
    return;
  }

  for (const agreement of requirements.licenseAgreements) {
    logger.info(`Accepted license agreement: ${agreement.id}`);
    logger.info(`Agreement title: ${agreement.title}`);
  }

  // Present license agreements in a webview panel
  if (requirements.licenseAgreements.length > 0) {
    if (!extensionContext) {
      void vscode.window.showErrorMessage(
        'Extension context not available for license UI.'
      );
      return;
    }
    const accepted = await showLicenseAgreementPanel(
      extensionContext,
      requirements.licenseAgreements
    );
    if (!accepted) {
      return;
    }
    for (const agreement of requirements.licenseAgreements) {
      preAnswers.push({ id: agreement.id, answer: agreement.acceptText });
    }
  }

  const options =
    preAnswers.length > 0 ? { preAnsweredAgreements: preAnswers } : undefined;

  const pkgLabel = `${pkg.name || pkg.id} ${pkg.version}`;

  // Two separate progress notifications: cancellable download, then non-cancellable install.
  // We track which notification is active and swap when the phase changes.
  type ProgressReporter = vscode.Progress<{
    message?: string;
    increment?: number;
  }>;

  let activeProgress: ProgressReporter | undefined;
  let lastPct = 0;
  let currentPhase: ProgressType | undefined;
  let cancelledByUser = false;

  // Resolvers to end each withProgress notification from outside
  let endDownloadPhase: (() => void) | undefined;
  let endInstallPhase: (() => void) | undefined;

  const installDone = packages
    .install([pkgRef], options, {
      onProgress: (info) => {
        const pct = Math.round(info.progress);
        const phase = info.type;

        // Switch from download to install notification when phase changes
        if (phase !== currentPhase) {
          currentPhase = phase;
          lastPct = 0;

          if (phase === ProgressType.Install) {
            endDownloadPhase?.();
            // Start install phase notification (non-cancellable)
            void vscode.window.withProgress(
              {
                location: vscode.ProgressLocation.Notification,
                title: `Installing ${pkgLabel}`,
                cancellable: false
              },
              async (progress) =>
                new Promise<void>((resolve) => {
                  activeProgress = progress;
                  endInstallPhase = resolve;
                })
            );
          }
        }

        if (!activeProgress) {
          return;
        }

        if (pct < lastPct) {
          activeProgress.report({
            message: `${String(pct)}%`,
            increment: -100
          });
          lastPct = 0;
        }
        const increment = pct - lastPct;
        lastPct = pct;
        activeProgress.report({
          message: `${String(pct)}%`,
          increment
        });
      },
      onMessage: (info) => {
        logger.info(`InstallPackageById: ${info.message}`);
      },
      onPrompt: handleUserPrompt
    })
    .then(() => {
      endDownloadPhase?.();
      endInstallPhase?.();
      void vscode.window.showInformationMessage(
        `Successfully installed ${pkg.name || pkg.id}`
      );
      void vscode.commands.executeCommand(
        'setContext',
        `${EXTENSION_ID}.packageInstalled`,
        true
      );
      // Re-render so the framework step's install button is recomputed as
      // disabled now that a version is installed.
      refreshWalkthrough();
      registerInstalledQtPaths(pkg.version);
    })
    .catch((err: unknown) => {
      endDownloadPhase?.();
      endInstallPhase?.();
      if (cancelledByUser) {
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      const errMsg = `Failed to install ${pkg.name || pkg.id} ${pkg.version} : ${msg}`;
      logger.error(errMsg);
      void vscode.window.showErrorMessage(errMsg);
    });

  // Start with the download phase notification (cancellable)
  logger.info(
    `Installing package ${pkg.name || pkg.id} with options: ${JSON.stringify(options)}`
  );
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Downloading ${pkgLabel}`,
      cancellable: true
    },
    async (progress, token) =>
      new Promise<void>((resolve) => {
        activeProgress = progress;
        endDownloadPhase = resolve;

        token.onCancellationRequested(() => {
          cancelledByUser = true;
          logger.info('User cancelled installation');
          packages
            .cancel({
              onMessage: (info) => {
                logger.info(`cancel: ${info.message}`);
              }
            })
            .then(() => {
              logger.info('Installation cancelled successfully');
            })
            .catch((cancelErr: unknown) => {
              const msg =
                cancelErr instanceof Error
                  ? cancelErr.message
                  : String(cancelErr);
              logger.error(`Failed to cancel installation: ${msg}`);
              void vscode.window.showErrorMessage(
                `Failed to cancel installation: ${msg}`
              );
            })
            .finally(() => {
              resolve();
            });
        });
      })
  );

  await installDone;
}

export async function setInstallationPath(): Promise<void> {
  const config = vscode.workspace.getConfiguration(EXTENSION_ID);
  const currentPath = config.get<string>(CONF_INSTALLATION_PATH) ?? '';

  const dirUris = await vscode.window.showOpenDialog({
    title: 'Select installation directory',
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    ...(currentPath ? { defaultUri: vscode.Uri.file(currentPath) } : {})
  });
  const dirUri = dirUris?.[0];
  if (!dirUri) {
    return;
  }

  await validateAndSetInstallationPath(dirUri.fsPath);
}

export async function onInstallationPathChanged(): Promise<void> {
  const config = vscode.workspace.getConfiguration(EXTENSION_ID);
  const rawPath = config.get<string>(CONF_INSTALLATION_PATH);
  if (!rawPath) {
    return;
  }
  const installPath = resolveConfiguration(rawPath);
  const session = await ensureConnected();
  const settings = new Settings(session);
  await settings.setInstallationPath(installPath);
}

async function validateAndSetInstallationPath(insPath: string): Promise<void> {
  const config = vscode.workspace.getConfiguration(EXTENSION_ID);
  try {
    const session = await ensureConnected();
    const settings = new Settings(session);
    await settings.setInstallationPath(insPath);
    await config.update(
      CONF_INSTALLATION_PATH,
      insPath,
      vscode.ConfigurationTarget.Global
    );
    void vscode.window.showInformationMessage(
      `Installation path set to: ${insPath}`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    void vscode.window.showErrorMessage(`Invalid installation path: ${msg}`);
  }
}

export async function login(
  authProvider: QtAccountAuthenticationProvider
): Promise<void> {
  const sessions = await authProvider.getSessions();
  if (sessions.length > 0 && sessions[0]) {
    void vscode.window.showInformationMessage(
      `Already signed in as ${sessions[0].account.label}`
    );
    return;
  }
  try {
    await authProvider.createSession([AUTH_PROVIDER_ID]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg !== 'Login cancelled') {
      const errMsg = `Qt Account login failed: ${msg}`;
      logger.error(errMsg);
      void vscode.window.showErrorMessage(errMsg);
    }
  }
}

export async function logout(
  authProvider: QtAccountAuthenticationProvider
): Promise<void> {
  const sessions = await authProvider.getSessions();
  for (const s of sessions) {
    await authProvider.removeSession(s.id);
  }
}

/**
 * Reset all qt-sm local state. **For testing purposes only.**
 *
 * This removes:
 *   - The Qt installation directory (e.g. ~/QtAlpha)
 *   - QtCompany.ini (service settings)
 *   - qtaccount.ini (Qt account credentials)
 *   - The QtSoftwareManagementService lock file
 *   - The IPC socket / named pipe
 *
 * It also kills any running QtSoftwareManagementService process and
 * disconnects the current IPC session.
 */
export async function resetTestState(): Promise<void> {
  const confirm = await vscode.window.showWarningMessage(
    'This will remove all qt-sm data (installed packages, credentials, ' +
      'service state). This action is for testing purposes only and cannot ' +
      'be undone. Continue?',
    { modal: true },
    'Reset'
  );
  if (confirm !== 'Reset') {
    return;
  }

  // Sign out before tearing down
  if (authProviderInstance) {
    await logout(authProviderInstance);
  }

  disconnect();

  // Kill the service process
  await killServiceProcess();

  const config = vscode.workspace.getConfiguration(EXTENSION_ID);
  const rawInstallPath =
    config.get<string>(CONF_INSTALLATION_PATH) ?? '~/QtAlpha';
  const installPath = resolveConfiguration(rawInstallPath);

  const pathsToRemove = [
    installPath,
    QtAccountStorage.defaultQtCompanyPath(),
    QtAccountStorage.defaultPath(),
    getServiceLockFilePath(),
    IPC.defaultSocket
  ];

  const removed: string[] = [];
  for (const p of pathsToRemove) {
    if (tryRemove(p)) {
      removed.push(p);
    }
  }

  if (removed.length > 0) {
    logger.info(`Reset test state. Removed: ${removed.join(', ')}`);
    void vscode.window.showInformationMessage(
      `qt-sm test state has been reset. Removed ${String(removed.length)} item(s).`
    );
  } else {
    logger.info('Reset test state: nothing to remove');
    void vscode.window.showInformationMessage(
      'qt-sm test state: nothing to remove.'
    );
  }

  // Remove registered Qt paths that are inside the install directory
  const coreConfig = vscode.workspace.getConfiguration(CORE_EXTENSION_ID);
  const existing = coreConfig.inspect<(string | object)[]>(
    AdditionalQtPathsName
  );
  const currentPaths: (string | object)[] = existing?.globalValue ?? [];
  const filtered = currentPaths.filter((p) => {
    const pPath = typeof p === 'string' ? p : (p as { path: string }).path;
    return !pPath.startsWith(installPath);
  });
  if (filtered.length !== currentPaths.length) {
    await coreConfig.update(
      AdditionalQtPathsName,
      filtered.length > 0 ? filtered : undefined,
      vscode.ConfigurationTarget.Global
    );
    logger.info(
      `Removed ${String(currentPaths.length - filtered.length)} Qt path(s) under ${installPath}`
    );
  }
}

function getServiceLockFilePath(): string {
  if (process.platform === 'win32') {
    return path.join(os.tmpdir(), 'QtSoftwareManagementService.lock');
  }
  return path.join(os.tmpdir(), 'QtSoftwareManagementService.lock');
}

function tryRemove(targetPath: string): boolean {
  try {
    if (!fs.existsSync(targetPath)) {
      return false;
    }
    const stat = fs.statSync(targetPath);
    if (stat.isDirectory()) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(targetPath);
    }
    logger.info(`Removed: ${targetPath}`);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`Failed to remove ${targetPath}: ${msg}`);
    return false;
  }
}

async function killServiceProcess(): Promise<void> {
  const processName = 'QtSoftwareManagementService';
  try {
    const { exec } = await import('child_process');
    await new Promise<void>((resolve) => {
      const cmd =
        process.platform === 'win32'
          ? `taskkill /F /IM ${processName}.exe`
          : `pkill -f ${processName}`;
      exec(cmd, (err) => {
        if (err) {
          logger.info(
            `No running ${processName} process found (or kill failed)`
          );
        } else {
          logger.info(`Killed ${processName} process`);
        }
        resolve();
      });
    });
  } catch {
    logger.warn('Failed to kill service process');
  }
}

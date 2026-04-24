// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import {
  Packages,
  Settings,
  type PackageData,
  type LicenseAgreement,
  type LicenseAnswer,
  type UserPrompt,
  type UserPromptReply,
  InstallState,
  UserPromptType,
  ProgressType
} from 'sms-api';

import { createLogger, resolveConfiguration } from 'qt-lib';
import { EXTENSION_ID, CONF_INSTALLATION_PATH } from '@/constants';
import { ensureConnected } from '@/service-connection';

const logger = createLogger('commands');

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

async function showLicenseAgreement(
  agreement: LicenseAgreement
): Promise<boolean> {
  const detail = agreement.text
    ? `${agreement.text.substring(0, 2000)}${agreement.text.length > 2000 ? '\n\n...(truncated)' : ''}`
    : agreement.title;

  const choice = await vscode.window.showInformationMessage(
    agreement.title,
    { modal: true, detail },
    agreement.acceptText,
    agreement.rejectText
  );
  return choice === agreement.acceptText;
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
        packages.searchAvailablePackages(undefined, undefined, {
          onMessage: (info) => {
            logger.info(`searchAvailablePackages: ${info.message}`);
          },
          onPrompt: handleUserPrompt
        })
    );

    if (results.length === 0) {
      void vscode.window.showInformationMessage('No packages found.');
      return;
    }

    const items = results.map((pkg: PackageData) => ({
      label: pkg.name || pkg.id,
      description: `${pkg.version} — ${installStateLabel(pkg.installState)}`,
      detail: `${pkg.description} (${formatSize(pkg.uncompressedSize)})`,
      pkg
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a package to view details',
      matchOnDescription: true,
      matchOnDetail: true
    });

    if (selected) {
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
        `- **Status:** ${installStateLabel(selected.pkg.installState)}`
      ].join('\n');

      logger.info(`Package details:\n${info.replace(/\n/g, '\n> ')}`);

      const action = await vscode.window.showInformationMessage(
        info,
        { modal: true },
        ...(selected.pkg.installState === InstallState.Uninstalled
          ? ['Install']
          : [])
      );

      if (action === 'Install') {
        await installPackageById(packages, selected.pkg);
      }
    }
  });
}

export async function listInstalledPackages(): Promise<void> {
  await withService(async (packages) => {
    const results = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Listing installed packages...',
        cancellable: false
      },
      async () =>
        packages.listInstalledPackages(undefined, undefined, {
          onMessage: (info) => {
            logger.info(`listInstalledPackages: ${info.message}`);
          },
          onPrompt: handleUserPrompt
        })
    );

    if (results.length === 0) {
      void vscode.window.showInformationMessage('No installed packages found.');
      return;
    }

    const items = results.map((pkg: PackageData) => ({
      label: pkg.name || pkg.id,
      description: pkg.version,
      detail: pkg.description
    }));

    await vscode.window.showQuickPick(items, {
      placeHolder: 'Installed packages',
      matchOnDescription: true,
      matchOnDetail: true
    });
  });
}

export async function installPackage(): Promise<void> {
  await withService(async (packages) => {
    const results = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Fetching available packages...',
        cancellable: false
      },
      async () =>
        packages.searchAvailablePackages(undefined, undefined, {
          onMessage: (info) => {
            logger.info(`searchAvailablePackages: ${info.message}`);
          },
          onPrompt: handleUserPrompt
        })
    );

    const uninstalled = results.filter(
      (pkg: PackageData) => pkg.installState === InstallState.Uninstalled
    );

    if (uninstalled.length === 0) {
      void vscode.window.showInformationMessage(
        'No packages available for installation.'
      );
      return;
    }

    const items = uninstalled.map((pkg: PackageData) => ({
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

async function installPackageById(
  packages: Packages,
  pkg: PackageData
): Promise<void> {
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

  // Block if there are unsatisfied rules
  // TODO: Enable this later on
  // if (requirements.unsatisfiedRules.length > 0) {
  //   const messages = requirements.unsatisfiedRules.map((r) => r.userMessage);
  //   void vscode.window.showErrorMessage(
  //     `Cannot install ${pkg.name || pkg.id}: ${messages.join('; ')}`
  //   );
  //   return;
  // }

  // Present license agreements
  for (const agreement of requirements.licenseAgreements) {
    const accepted = await showLicenseAgreement(agreement);
    if (!accepted) {
      void vscode.window.showInformationMessage('Installation cancelled.');
      return;
    }
    preAnswers.push({ id: agreement.id, answer: agreement.acceptText });
  }

  const options =
    preAnswers.length > 0 ? { preAnsweredAgreements: preAnswers } : undefined;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Installing ${pkg.name || pkg.id}...`,
      cancellable: false
    },
    async (progress) => {
      let lastPct = 0;
      try {
        // log options
        logger.info(
          `Installing package ${pkg.name || pkg.id} with options: ${JSON.stringify(
            options
          )}`
        );
        await packages.install([pkgRef], options, {
          onProgress: (info) => {
            const pct = Math.round(info.progress);
            const phase =
              info.type === ProgressType.Download
                ? 'Downloading'
                : info.type === ProgressType.Install
                  ? 'Installing'
                  : (info.message ?? '');
            logger.info(
              `Install progress (${info.type}): ${String(pct)}% - ${phase}`
            );
            // Reset baseline when a new phase starts (progress goes backwards)
            if (pct < lastPct) {
              progress.report({
                message: `${phase ? `${phase} ` : ''}${String(pct)}%`,
                increment: -100
              });
              lastPct = 0;
            }
            const increment = pct - lastPct;
            lastPct = pct;
            progress.report({
              message: `${phase ? `${phase} ` : ''}${String(pct)}%`,
              increment
            });
          },
          onMessage: (info) => {
            logger.info(`InstallPackageById: ${info.message}`);
          },
          onPrompt: handleUserPrompt
        });
        void vscode.window.showInformationMessage(
          `Successfully installed ${pkg.name || pkg.id}`
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const errMsg = `Failed to install ${pkg.name || pkg.id}: ${msg}`;
        logger.error(errMsg);
        void vscode.window.showErrorMessage(errMsg);
      }
    }
  );
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
  await validateAndSetInstallationPath(installPath);
}

async function validateAndSetInstallationPath(path: string): Promise<void> {
  const config = vscode.workspace.getConfiguration(EXTENSION_ID);

  try {
    const session = await ensureConnected();
    const settings = new Settings(session);
    await settings.setInstallationPath(path);
    await config.update(
      CONF_INSTALLATION_PATH,
      path,
      vscode.ConfigurationTarget.Global
    );
    void vscode.window.showInformationMessage(
      `Installation path set to: ${path}`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    void vscode.window.showErrorMessage(`Invalid installation path: ${msg}`);
  }
}

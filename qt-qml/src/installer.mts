// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { spawnSync } from 'child_process';

import {
  OSExeSuffix,
  fetchWithAbort,
  createLogger,
  UserLocalDir,
  FetchAbortReason,
  IsWindows,
  IsMacOS,
  IsLinux,
  IsArm64
} from 'qt-lib';
import * as unzipper from '@/unzipper.js';
import * as downloader from '@/downloader.js';
import { setDoNotAskForDownloadingQmlls } from '@/qmlls.mjs';

const ReleaseInfoUrl = 'https://qtccache.qt.io/QMLLS/LatestRelease';
const ReleaseInfoTimeout = 10 * 1000;
const DownloadDir = os.tmpdir();

let InstallDir: string;
let ExtractDir: string;
let QmllsExePath: string;
let ReleaseJsonPath: string;

const logger = createLogger('installer');

/**
 * Initialize the installer with the global storage URI from VS Code extension context.
 * Must be called before using any other installer functions.
 * @param globalStorageUri The URI to the extension's global storage directory
 */
export function initialize(globalStorageUri: vscode.Uri) {
  const globalStoragePath = globalStorageUri.fsPath;
  InstallDir = path.join(globalStoragePath, 'qmlls');
  ExtractDir = path.join(InstallDir, 'files');
  QmllsExePath = path.join(InstallDir, 'files', 'qmlls' + OSExeSuffix);
  ReleaseJsonPath = path.join(InstallDir, 'release.json');
  logger.info(`Installer initialized with path: ${InstallDir}`);

  // Clean up old installation directory that polluted the user file system
  cleanupOldInstallation();
}

/**
 * Removes the old qmlls installation directory from the user's local data directory.
 * This cleanup is needed because we previously installed qmlls in UserLocalDir/qmlls,
 * which polluted the user's file system. We now use VS Code's globalStorageUri.
 */
function cleanupOldInstallation() {
  if (!UserLocalDir) {
    return;
  }

  const oldInstallDir = path.join(UserLocalDir, 'qmlls');

  // Only attempt cleanup if the old directory exists and is different from the new one
  if (oldInstallDir === InstallDir) {
    return;
  }

  if (fs.existsSync(oldInstallDir)) {
    try {
      logger.info(
        `Removing old qmlls installation directory: ${oldInstallDir}`
      );
      fs.rmSync(oldInstallDir, { recursive: true, force: true });
      logger.info('Old qmlls installation directory removed successfully');
    } catch (error) {
      logger.warn(
        `Failed to remove old qmlls installation directory: ${String(error)}`
      );
    }
  }
}

interface Asset {
  id: string;
  name: string;
  size: number;
  browser_download_url: string;
  created_at: string;
}

export interface AssetWithTag extends Asset {
  tag_name: string;
}

interface CheckResult {
  message: string;
  shouldInstall: boolean;
}

export function getExpectedQmllsPath() {
  return QmllsExePath;
}

export function checkStatusAgainst(asset: AssetWithTag): CheckResult {
  // check installation
  if (!fs.existsSync(ReleaseJsonPath) || !fs.existsSync(QmllsExePath)) {
    return {
      message: 'Not Installed',
      shouldInstall: true
    };
  }

  // check if outdated
  const local = JSON.parse(fs.readFileSync(ReleaseJsonPath, 'utf8')) as {
    tag_name: string;
  };

  if (local.tag_name !== asset.tag_name) {
    return {
      message:
        'Tag mismatch, ' +
        `local = ${local.tag_name}, ` +
        `recent = ${asset.tag_name}`,
      shouldInstall: true
    };
  }

  // check if executable
  const res = spawnSync(QmllsExePath, ['--help'], { timeout: 1000 });
  if (res.status !== 0) {
    return {
      message: 'Found, but not executable',
      shouldInstall: true
    };
  }

  return {
    message: `Already Up-to-date, tag = ${asset.tag_name}`,
    shouldInstall: false
  };
}

export async function getUserConsent(): Promise<boolean> {
  const prompt = 'Install';
  const doNotShowAgain = 'Do not show again';
  const message =
    'A newer version of the QML language server is available. ' +
    'Do you want to install it?';

  const ans = await vscode.window.showInformationMessage(
    message,
    prompt,
    doNotShowAgain
  );
  if (ans === doNotShowAgain) {
    void setDoNotAskForDownloadingQmlls(true);
  }
  return ans === prompt;
}

export async function install(asset: AssetWithTag) {
  const tmpPath = path.join(DownloadDir, asset.name);

  // download, unzip
  logger.info(`Downloading from: ${asset.browser_download_url}`);
  await downloadWithProgress(asset.browser_download_url, tmpPath);
  logger.info(`Unzipping to: ${ExtractDir}`);
  await unzipWithProgress(tmpPath);

  // follow up
  logger.info(`QML language server installed to: ${QmllsExePath}`);
  fs.chmodSync(QmllsExePath, 0o755);
  fs.unlinkSync(tmpPath);
  fs.writeFileSync(
    ReleaseJsonPath,
    JSON.stringify({ tag_name: asset.tag_name }, null, 2)
  );
}

export async function fetchAssetToInstall(controller: AbortController) {
  try {
    const res = await fetchWithAbort(ReleaseInfoUrl, {
      controller: controller,
      timeout: ReleaseInfoTimeout
    });

    if (!res) {
      // Aborted - check the reason
      const reason = controller.signal.reason as FetchAbortReason;
      if (reason === FetchAbortReason.Timeout) {
        void vscode.window.showErrorMessage(
          'Failed to fetch QML Language Server release information: Request timed out. Please check your network connection and try again.'
        );
        logger.warn('Fetching QML Language Server release info timed out');
      } else {
        // User cancelled
        logger.info('User cancelled fetching QML Language Server release info');
      }
      return undefined;
    }

    if (!res.ok) {
      void vscode.window.showErrorMessage(
        `Failed to fetch QML Language Server release information: Unexpected HTTP status ${res.status}.`
      );
      logger.warn(`Unexpected HTTP status, code = ${res.status.toFixed(0)}`);
      return undefined;
    }

    logger.info(`Fetched release info from: ${ReleaseInfoUrl}`);

    const json = (await res.json()) as {
      tag_name: string;
      assets: Asset[];
    };

    // Determine platform and architecture
    let platform = '';
    let arch = '';

    if (IsWindows) {
      platform = 'windows';
      arch = IsArm64 ? 'arm64' : 'x64';
    } else if (IsMacOS) {
      platform = 'macos';
      arch = 'universal'; // macOS uses universal binaries
    } else if (IsLinux) {
      platform = 'linux';
      arch = IsArm64 ? 'arm64' : 'x64';
    } else {
      throw new Error(`Platform is not supported`);
    }

    const prefix = `qmllanguageserver-${platform}-${arch}`;

    const matchingAssets = json.assets.filter((asset) =>
      asset.name.startsWith(prefix)
    );
    matchingAssets.sort((a, b) => {
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
    const selectedAsset = matchingAssets[0];
    if (!selectedAsset) {
      throw new Error(
        `Cannot find a package for the current platform: ${platform}-${arch}`
      );
    }

    logger.info(`Selected asset: ${selectedAsset.name}`);

    return {
      tag_name: json.tag_name,
      ...selectedAsset
    } as AssetWithTag;
  } catch (error) {
    void vscode.window.showErrorMessage(
      `Failed to fetch QML Language Server release information: ${error instanceof Error ? error.message : String(error)}`
    );
    logger.warn(
      `Network error fetching QML Language Server release info: ${error instanceof Error ? error.message : String(error)}`
    );
    return undefined;
  }
}

async function downloadWithProgress(url: string, destPath: string) {
  const downloadTask = async (
    progress: vscode.Progress<{ message?: string; increment?: number }>,
    token: vscode.CancellationToken
  ) => {
    let lastPercentage = 0;
    const progressUpdater = (current: number, max: number) => {
      const maxSize = (max / 1024 / 1024).toFixed(1);
      const currentSize = (current / 1024 / 1024).toFixed(1);
      const percentage = Math.round((current / max) * 100);

      progress.report({
        message: `${currentSize}/${maxSize} MiB`,
        increment: percentage - lastPercentage
      });

      lastPercentage = percentage;
    };

    await downloader.download(url, destPath, token, progressUpdater);
  };

  const options = {
    title: 'Acquiring QML language server',
    location: vscode.ProgressLocation.Notification,
    cancellable: true
  };

  await vscode.window.withProgress(options, downloadTask);
}

async function unzipWithProgress(zipPath: string) {
  const unzipTask = async (
    progress: vscode.Progress<{ message?: string; increment?: number }>
  ) => {
    const unzipStreamProvider = (entry: unzipper.Entry) => {
      const name = entry.fileName;
      const dest = path.join(ExtractDir, name);

      fs.mkdirSync(path.dirname(dest), { recursive: true });
      progress.report({ message: name });

      if (entry.fileName.endsWith('/')) {
        return null;
      }

      return fs.createWriteStream(dest);
    };

    await unzipper.unzip(zipPath, unzipStreamProvider);
  };

  const options = {
    title: 'Installing QML language server',
    location: vscode.ProgressLocation.Notification,
    cancellable: false
  };

  await vscode.window.withProgress(options, unzipTask);
}

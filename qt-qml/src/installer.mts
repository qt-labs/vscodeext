// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { spawn } from 'child_process';

import {
  OSExeSuffix,
  fetchWithAbort,
  createLogger,
  UserLocalDir,
  FetchAbortReason,
  IsWindows,
  IsMacOS,
  IsLinux,
  IsArm64,
  assertInside
} from 'qt-lib';
import * as unzipper from '@/unzipper.js';
import * as downloader from '@/downloader.js';
import { sha256OfFile, digestMatches } from '@/integrity.js';
import { setDoNotAskForDownloadingQmlls } from '@/qmlls.mjs';
import {
  VersionedInstallations,
  type InstallVersion
} from '@/versioned-installations.mjs';
import { projectManager } from './extension.mts';
import { QmllsOperationType } from './qmlls-queue.mts';

export { ManifestFileName } from '@/versioned-installations.mjs';
export type { InstallVersion } from '@/versioned-installations.mjs';

const ReleaseInfoUrl = 'https://qtccache.qt.io/QMLLS/LatestRelease';
const ReleaseInfoTimeout = 10 * 1000;
const DownloadDir = os.tmpdir();
const QmllsExeName = 'qmlls' + OSExeSuffix;

let InstallDir: string;
let installations: VersionedInstallations;

const logger = createLogger('installer');

/**
 * Initialize the installer with the global storage URI from VS Code extension context.
 * Must be called before using any other installer functions.
 * @param globalStorageUri The URI to the extension's global storage directory
 */
export function initialize(globalStorageUri: vscode.Uri) {
  const globalStoragePath = globalStorageUri.fsPath;
  InstallDir = path.join(globalStoragePath, 'qmlls');
  installations = new VersionedInstallations(InstallDir, QmllsExeName);
  // The manifest watcher needs an existing directory to watch.
  fs.mkdirSync(InstallDir, { recursive: true });
  logger.info(`Installer initialized with path: ${InstallDir}`);

  // Clean up old installation directory that polluted the user file system
  cleanupOldInstallation();

  try {
    const migrated = installations.migrateLegacyLayout(
      path.join(InstallDir, 'files'),
      path.join(InstallDir, 'release.json')
    );
    if (migrated) {
      logger.info('Migrated legacy qmlls installation to the versioned layout');
    }
  } catch (error) {
    logger.warn(`Legacy qmlls layout migration failed: ${String(error)}`);
  }

  collectGarbage();

  const current = getInstalledVersion();
  if (current) {
    logger.info(
      `Current qmlls version: ${current.tag}, uploaded: ${current.createdAt || '<unknown>'} (${resolveQmllsExePath() ?? 'exe missing'})`
    );
  } else {
    logger.info('No managed qmlls version installed');
  }
}

/**
 * The directory holding the versioned qmlls installations and the manifest.
 */
export function getInstallRoot(): string {
  return InstallDir;
}

/**
 * Resolve the exe of the currently published qmlls version, or undefined if
 * none is installed. Resolved fresh on every call because another VS Code
 * instance may publish a new version and garbage-collect the previous one at
 * any time.
 */
export function resolveQmllsExePath(): string | undefined {
  return installations.resolveCurrentExePath();
}

/**
 * The identity (tag and asset upload time) of the currently published qmlls
 * version, if any. The upload time is empty for installs that predate
 * upload-time tracking.
 */
export function getInstalledVersion(): InstallVersion | undefined {
  return installations.readManifest();
}

/**
 * Best-effort removal of everything except the current version. Version
 * dirs whose exe is still running (Windows locks them) are skipped and
 * retried on a later run; on Unix, deleting a running exe is harmless.
 */
function collectGarbage() {
  try {
    const result = installations.collectGarbage();
    if (result.removed.length > 0) {
      logger.info(
        `Removed outdated qmlls installs: ${result.removed.join(', ')}`
      );
    }
    if (result.skipped.length > 0) {
      logger.info(
        `Skipped qmlls installs that could not be removed (likely still in use): ${result.skipped.join(', ')}`
      );
    }
  } catch (error) {
    logger.warn(`qmlls garbage collection failed: ${String(error)}`);
  }
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
  // SHA256 of the asset ("sha256:<hex>"), shipped by the release manifest and
  // used to verify the download before it is unzipped, chmod'd, or run.
  digest?: string;
}

export interface AssetWithTag extends Asset {
  tag_name: string;
}

export enum AssetStatus {
  Outdated,
  UpToDate,
  NotInstalled
}
interface CheckResult {
  message: string;
  status: AssetStatus;
}

const RunnableProbeTimeoutMs = 2000;

/**
 * Smoke-test a freshly unpacked qmlls before it is committed as a version.
 * Runs asynchronously, so a slow first start never blocks the extension
 * host. A process that is still running when the probe expires counts as
 * runnable: the image loaded and executed, which is what this asks. Only a
 * failure to spawn or a non-zero exit means the artifact is unusable, and
 * both of those are immediate.
 *
 * `args` and `timeoutMs` exist so the probe's classification can be tested
 * against a known executable; production always uses the defaults.
 */
export async function isRunnable(
  exePath: string,
  args: string[] = ['--help'],
  timeoutMs = RunnableProbeTimeoutMs
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    // No pipes: nothing here reads the child's output, and a child that
    // fills the pipe buffer would block until the probe expires instead of
    // exiting. Buffer capacity is platform-dependent and smallest on Windows.
    const child = spawn(exePath, args, { stdio: 'ignore' });
    const timer = setTimeout(() => {
      child.kill();
      resolve(true);
    }, timeoutMs);
    child.on('error', (error) => {
      clearTimeout(timer);
      // Says which of the two failures happened: refused by the OS (an
      // unnotarized binary under Gatekeeper, a missing exec bit) reads very
      // differently from a binary that ran and rejected --help.
      logger.warn(`qmlls probe could not start ${exePath}: ${String(error)}`);
      resolve(false);
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve(code === 0);
    });
  });
}

function versionOf(asset: AssetWithTag): InstallVersion {
  return { tag: asset.tag_name, createdAt: asset.created_at };
}

export function checkStatusAgainst(asset: AssetWithTag): CheckResult {
  // check installation
  const local = getInstalledVersion();
  const exePath = resolveQmllsExePath();
  if (!local || !exePath) {
    return {
      message: 'Not Installed',
      status: AssetStatus.NotInstalled
    };
  }

  // check if outdated
  if (local.tag !== asset.tag_name) {
    return {
      message:
        'Tag mismatch, ' +
        `local = ${local.tag}, ` +
        `recent = ${asset.tag_name}`,
      status: AssetStatus.Outdated
    };
  }

  if (local.createdAt !== asset.created_at) {
    return {
      message:
        'Upload time mismatch, ' +
        `local = ${local.createdAt || '<unknown>'}, ` +
        `recent = ${asset.created_at}`,
      status: AssetStatus.Outdated
    };
  }

  return {
    message: `Already Up-to-date, tag = ${asset.tag_name}`,
    status: AssetStatus.UpToDate
  };
}

export async function getUserConsent(isNewInstall: boolean): Promise<boolean> {
  const prompt = 'Install';
  const doNotShowAgain = 'Do not show again';
  const message = isNewInstall
    ? 'Do you want to install the QML language server?'
    : 'A newer version of the QML language server is available. ' +
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
  return projectManager.qmllsQueue.enqueue(
    QmllsOperationType.Install,
    async () => {
      // Another VS Code instance may have installed this exact build (same
      // tag and upload time) already; then only the manifest needs to be
      // published.
      const version = versionOf(asset);
      if (installations.hasVersion(version)) {
        logger.info(
          `${asset.tag_name} (uploaded ${asset.created_at}) is already installed, publishing it`
        );
        installations.publishCurrent(version);
        collectGarbage();
        return;
      }

      // The pid in the name keeps parallel downloads from different VS Code
      // instances from clobbering each other's file.
      const tmpPath = path.join(
        DownloadDir,
        `qmlls-${process.pid.toFixed(0)}-${asset.name}`
      );

      logger.info(
        `Downloading from: ${asset.browser_download_url} to: ${tmpPath}`
      );
      await downloadWithProgress(asset.browser_download_url, tmpPath);
      logger.info(`Download finished: ${tmpPath}`);

      // Extract into a private staging dir and atomically rename it into
      // place, so a version dir is either absent or complete and running
      // exes are never overwritten. If the rename loses the race against
      // another instance installing the same version, theirs is used.
      const stagingDir = installations.createStagingDir();
      try {
        // Integrity gate: verify the downloaded bytes against the SHA256 digest
        // the release manifest ships, before we unzip, chmod, or run anything.
        // Fail closed if the digest is missing or does not match.
        if (!asset.digest) {
          throw new Error(
            `Refusing to install ${asset.name}: the release manifest did not provide a SHA256 digest to verify the download.`
          );
        }
        const actualDigest = await sha256OfFile(tmpPath);
        if (!digestMatches(asset.digest, actualDigest)) {
          throw new Error(
            `Integrity check failed for ${asset.name}: the download does not match the expected SHA256 digest.`
          );
        }
        logger.info(`Integrity check passed for: ${asset.name}`);

        logger.info(`Unzipping to: ${stagingDir}`);
        await unzipWithProgress(tmpPath, stagingDir);
        logger.info(`Unzipping finished: ${stagingDir}`);

        const stagedExe = path.join(stagingDir, QmllsExeName);
        logger.info(`Setting executable permission for: ${stagedExe}`);
        fs.chmodSync(stagedExe, 0o755);
        logger.info(`Executable permission set for: ${stagedExe}`);
        if (!(await isRunnable(stagedExe))) {
          logger.error(`Staged qmlls is not runnable: ${stagedExe}`);
          throw new Error(`${stagedExe} is not runnable`);
        }
        logger.info(`Staged qmlls is runnable: ${stagedExe}`);
        const versionDir = installations.commitStagedInstall(
          stagingDir,
          version
        );
        logger.info(`QML language server installed to: ${versionDir}`);
      } catch (error) {
        logger.error(`Installation failed: ${String(error)}`);
        fs.rmSync(stagingDir, { recursive: true, force: true });
        throw error;
      } finally {
        logger.info(`Removing temporary download file: ${tmpPath}`);
        fs.rmSync(tmpPath, { force: true });
      }

      installations.publishCurrent(version);
      collectGarbage();
    }
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
        `Failed to fetch QML Language Server release information: Unexpected HTTP status ${res.status.toString()}.`
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
    title: 'Downloading QML language server',
    location: vscode.ProgressLocation.Notification,
    cancellable: true
  };

  await vscode.window.withProgress(options, downloadTask);
}

async function unzipWithProgress(zipPath: string, destDir: string) {
  const unzipTask = async (
    progress: vscode.Progress<{ message?: string; increment?: number }>
  ) => {
    const unzipStreamProvider = (entry: unzipper.Entry) => {
      const name = entry.fileName;
      const dest = path.join(destDir, name);
      assertInside(destDir, dest);

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

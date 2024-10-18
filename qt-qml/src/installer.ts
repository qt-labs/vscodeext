// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { spawnSync } from 'child_process';

import { UserLocalDir, OSExeSuffix } from 'qt-lib';
import * as unzipper from '@/unzipper';
import * as downloader from '@/downloader';

const ReleaseInfoUrl = 'https://qtccache.qt.io/QMLLS/LatestRelease';
const ReleaseInfoTimeout = 10 * 1000;
const DownloadDir = os.tmpdir();
const InstallDir = path.join(UserLocalDir, 'qmlls');
const ExtractDir = path.join(InstallDir, 'files');
const QmllsExePath = path.join(InstallDir, 'files', 'qmlls' + OSExeSuffix);
const ReleaseJsonPath = path.join(InstallDir, 'release.json');

interface Asset {
  id: string;
  name: string;
  size: number;
  browser_download_url: string;
}

interface AssetWithTag extends Asset {
  tag_name: string;
}

interface CheckResult {
  message: string;
  assetToInstall?: AssetWithTag;
}

export function getExpectedQmllsPath() {
  return QmllsExePath;
}

export async function checkStatus(): Promise<CheckResult> {
  const assetToInstall = await fetchAssetToInstall();

  // check installation
  if (!fs.existsSync(ReleaseJsonPath) || !fs.existsSync(QmllsExePath)) {
    return {
      message: 'Not Installed',
      assetToInstall
    };
  }

  // check if outdated
  const local = JSON.parse(fs.readFileSync(ReleaseJsonPath, 'utf8')) as {
    tag_name: string;
  };

  if (local.tag_name !== assetToInstall.tag_name) {
    return {
      message:
        'Tag mismatch, ' +
        `local = ${local.tag_name}, ` +
        `recent = ${assetToInstall.tag_name}`,
      assetToInstall
    };
  }

  // check if executable
  const res = spawnSync(QmllsExePath, ['--help'], { timeout: 1000 });
  if (res.status !== 0) {
    return {
      message: 'Found, but not executable',
      assetToInstall
    };
  }

  return {
    message: `Up-to-date, tag = ${assetToInstall.tag_name}`
  };
}

export async function getUserConsent(): Promise<boolean> {
  const prompt = 'Install';
  const message =
    'A newer version of the QML language server is available. ' +
    'Do you want to install it?';

  const ans = await vscode.window.showInformationMessage(message, prompt);
  return ans === prompt;
}

export async function install(asset: AssetWithTag) {
  const tmpPath = path.join(DownloadDir, asset.name);

  // download, unzip
  await downloadWithProgress(asset.browser_download_url, tmpPath);
  await unzipWithProgress(tmpPath);

  // follow up
  fs.chmodSync(QmllsExePath, 0o755);
  fs.unlinkSync(tmpPath);
  fs.writeFileSync(
    ReleaseJsonPath,
    JSON.stringify({ tag_name: asset.tag_name }, null, 2)
  );
}

async function fetchAssetToInstall() {
  const signal = AbortSignal.timeout(ReleaseInfoTimeout);
  const res = await fetch(ReleaseInfoUrl, { signal });
  if (!res.ok) {
    throw new Error(`Unexpected HTTP status, code = ${res.status.toFixed(0)}`);
  }

  const json = (await res.json()) as {
    tag_name: string;
    assets: Asset[];
  };

  let name = '';
  const platform = process.platform;

  if (platform === 'win32') {
    name = 'windows';
  } else if (platform === 'darwin') {
    name = 'macos';
  } else if (platform === 'linux') {
    name = 'ubuntu';
  } else {
    throw new Error(`Platform '${platform}' is not supported`);
  }

  const prefix = `qmlls-${name}`;

  for (const asset of json.assets) {
    if (asset.name.startsWith(prefix)) {
      return {
        tag_name: json.tag_name,
        ...asset
      } as AssetWithTag;
    }
  }

  throw new Error(`Cannot find a package for the platform '${platform}'`);
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

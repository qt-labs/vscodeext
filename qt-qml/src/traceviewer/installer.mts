// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { telemetry } from 'qt-lib';
import { extractWithProgress } from './extractor.mts';
import { InstallationManager } from './installation-manager.mts';
import { DownloadResult, downloadWithProgress } from './downloader.mts';
import { FolderLock } from './helpers/lock.mts';
import { createWrappedLogger } from './helpers/logger-wrapper.ts';
import * as consts from './constants.mts';

type Context = vscode.ExtensionContext;
const logger = createWrappedLogger('traceviewer-installer');

export function registerTraceViewerCommand(context: Context) {
  return vscode.commands.registerCommand(
    consts.COMMAND_DOWNLOAD_VIEWER_FULL,
    async () => {
      telemetry.sendAction(consts.COMMAND_DOWNLOAD_VIEWER);

      const installs = new InstallationManager(context);
      const lock = new FolderLock(installs.baseDir);

      try {
        await lock.withLock(async () => {
          await runInstall(installs);
        });
      } catch (e) {
        logger
          .text('Failed to install QML trace viewer')
          .data('error', e instanceof Error ? e.message : String(e))
          .error({ showMessage: true });
      }
    }
  );
}

async function runInstall(installs: InstallationManager) {
  const download = await runDownload(installs.activePackageId);
  if (download.result === 'up-to-date') {
    logger
      .text('QML trace viewer is already up-to-date')
      .info({ showMessage: true });
    return;
  }

  const release = await runExtract(installs.baseDir, download);
  await release.save(download.sourceUrl);

  installs.save({ recentId: download.id });
  installs.purge();

  logger
    .text('Installation complete')
    .data('id', download.id)
    .data('dir', release.baseDir)
    .info({ multipleLine: true });

  void vscode.window.showInformationMessage(
    'QML trace viewer installed successfully'
  );
}

async function runDownload(latestId: string | undefined) {
  logger.text('Downloading started...').info();

  const r = await downloadWithProgress(latestId);

  if (r.result === 'up-to-date') {
    logger
      .text('Downloading skipped, already up-to-date')
      .data('id', r.id)
      .info();
  } else {
    logger
      .text('Downloading done')
      .data('file', r.downloadedFilePath)
      .data('url', r.sourceUrl)
      .info({ multipleLine: true });
  }

  return r;
}

async function runExtract(
  installBaseDir: string,
  downloadResult: DownloadResult
) {
  logger
    .text('Extracting started')
    .data('id', downloadResult.id)
    .data('file', downloadResult.downloadedFilePath)
    .data('install-base-dir', installBaseDir)
    .info({ multipleLine: true });

  const r = await extractWithProgress(installBaseDir, downloadResult);
  logger.text('Extracting done').info();

  return r;
}

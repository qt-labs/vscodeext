// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import * as vscode from 'vscode';
import { spawnSync } from 'child_process';
import {
  Trace,
  ServerOptions,
  LanguageClient,
  LanguageClientOptions
} from 'vscode-languageclient/node';
import untildify from 'untildify';

import {
  createLogger,
  findQtKits,
  isError,
  exists,
  OSExeSuffix,
  QtInsRootConfigName,
  compareVersions,
  GlobalWorkspace
} from 'qt-lib';
import { coreAPI, projectManager } from '@/extension';
import { EXTENSION_ID } from '@/constants';
import * as installer from '@/installer';

const logger = createLogger('qmlls');
const QMLLS_CONFIG = `${EXTENSION_ID}.qmlls`;

interface QmllsExeConfig {
  qmllsPath: string;
  qtVersion: string;
}

export class Qmlls {
  private _client: LanguageClient | undefined;
  private _channel: vscode.OutputChannel | undefined;

  constructor() {
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (
        event.affectsConfiguration(QMLLS_CONFIG) ||
        event.affectsConfiguration(`${EXTENSION_ID}.${QtInsRootConfigName}`)
      ) {
        void this.restart();
      }
    });
  }

  public async start() {
    try {
      const r = await installer.checkStatus();
      logger.info('Status Check: ', r.message);

      if (r.assetToInstall) {
        if (!(await installer.getUserConsent())) {
          throw new Error('User declined to install qmlls');
        }

        logger.info(
          `Installing: ${r.assetToInstall.name}, ${r.assetToInstall.tag_name}`
        );

        await installer.install(r.assetToInstall);
        logger.info('Installation done');
      }
    } catch (error) {
      logger.warn(isError(error) ? error.message : String(error));
    }

    await this.startQmlls();
  }

  private async startQmlls() {
    const configs = vscode.workspace.getConfiguration(QMLLS_CONFIG);
    if (!configs.get<boolean>('enabled', false)) {
      return;
    }

    try {
      if (configs.get<string>('customExePath')) {
        const customPath = configs.get<string>('customExePath') ?? '';
        const untildifiedCustomPath = untildify(customPath);
        const res = spawnSync(untildifiedCustomPath, ['--help'], {
          timeout: 1000
        });
        if (res.status !== 0) {
          throw res.error ?? new Error(res.stderr.toString());
        }

        this.startLanguageClient(customPath);
      } else {
        const installed = installer.getExpectedQmllsPath();
        if (await exists(installed)) {
          this.startLanguageClient(installed);
          return;
        }

        const qmllsExeConfig = await findMostRecentExecutableQmlLS();
        if (!qmllsExeConfig) {
          throw new Error('not found');
        }
        // Don't start the language server if the version is older than 6.7.2
        // Because older versions of the qmlls are not stable
        if (compareVersions(qmllsExeConfig.qtVersion, '6.7.2') < 0) {
          const infoMessage =
            'Cannot turn on QML Language Server because the found Qt versions are older than 6.7.2. Please install a newer version of Qt.';
          void vscode.window.showInformationMessage(infoMessage);
          logger.info(infoMessage);
          return;
        }

        this.startLanguageClient(qmllsExeConfig.qmllsPath);
      }
    } catch (error) {
      if (isError(error)) {
        const message =
          'Cannot start QML language server. ' + createErrorString(error);

        void vscode.window.showErrorMessage(message);
        logger.error(message);
      }
    }
  }

  private startLanguageClient(qmllsPath: string) {
    const configs = vscode.workspace.getConfiguration(QMLLS_CONFIG);
    const verboseOutput = configs.get<boolean>('verboseOutput', false);
    const traceLsp = configs.get<string>('traceLsp', 'off');

    if (!this._channel) {
      this._channel = vscode.window.createOutputChannel('QML Language Server');
    }

    const serverOptions: ServerOptions = {
      command: qmllsPath,
      args: verboseOutput ? ['--verbose'] : []
    };

    const clientOptions: LanguageClientOptions = {
      documentSelector: [{ language: 'qml' }],
      outputChannel: this._channel
    };

    if (traceLsp !== 'off') {
      clientOptions.traceOutputChannel = this._channel;
    }

    // create and start the client,
    // this will also launch the server
    this._client = new LanguageClient('qmlls', serverOptions, clientOptions);
    this._client
      .start()
      .then(async () => {
        await this._client?.setTrace(Trace.fromString(traceLsp));
        vscode.workspace.onDidChangeWorkspaceFolders(async () => {
          await this.restart();
        });

        logger.info(`QML Language Server started, ${qmllsPath}`);
      })
      .catch(() => {
        void vscode.window.showErrorMessage('Cannot start QML language server');
        logger.error(`LanguageClient has failed to start with ${qmllsPath}`);
      });
  }

  public async stop() {
    if (this._client) {
      if (this._client.isRunning()) {
        await this._client
          .stop()
          .then(() => {
            logger.info('QML Language Server stopped');
          })
          .catch((e) => {
            logger.info(`QML Language Server stop failed, ${e}`);
          });
      }

      this._client = undefined;
    }

    if (this._channel) {
      this._channel.dispose();
      this._channel = undefined;
    }
  }

  public async restart() {
    await this.stop();
    await this.start();
  }
}

async function findMostRecentExecutableQmlLS(): Promise<
  QmllsExeConfig | undefined
> {
  const allQtInsRootDirs: string[] = [];
  for (const project of projectManager.getProjects()) {
    const qtInsRoot = coreAPI?.getValue<string>(
      project.folder,
      QtInsRootConfigName
    );
    if (qtInsRoot) {
      allQtInsRootDirs.push(qtInsRoot);
    }
  }
  const globalQtInsRoot = coreAPI?.getValue<string>(
    GlobalWorkspace,
    QtInsRootConfigName
  );
  if (globalQtInsRoot) {
    allQtInsRootDirs.push(globalQtInsRoot);
  }

  const found: QmllsExeConfig[] = [];

  for (const qtInsDir of allQtInsRootDirs) {
    const versionRegex = /^\d+\.\d+\.\d+$/;
    const allQt = await findQtKits(qtInsDir);

    for (const qt of allQt) {
      const relative = path.relative(qtInsDir, qt);
      const version = path.normalize(relative).split(path.sep)[0];
      if (!version || !versionRegex.test(version)) {
        continue;
      }

      found.push({
        qtVersion: version,
        qmllsPath: path.join(qt, 'bin', 'qmlls' + OSExeSuffix)
      });
    }
  }

  found.sort((a, b) => {
    return -1 * compareVersions(a.qtVersion, b.qtVersion);
  });

  for (const item of found) {
    const res = spawnSync(item.qmllsPath, ['--help'], { timeout: 1000 });
    if (res.status === 0) {
      return item;
    }
  }

  return undefined;
}

function createErrorString(e: Error): string {
  const casted = e as {
    code?: string;
    path?: string;
  };

  if (!casted.code) {
    return e.message;
  }

  const KnownErrors: Record<string, string> = {
    EPERM: 'Operation not permitted',
    ENOENT: 'No such file or directory',
    EACCES: 'Permission denied'
  };

  return (
    casted.path +
    ', ' +
    `${KnownErrors[casted.code] ?? 'Error'} (${casted.code})`
  );
}

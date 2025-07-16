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

import {
  createLogger,
  findQtKits,
  isError,
  exists,
  OSExeSuffix,
  QtInsRootConfigName,
  compareVersions,
  GlobalWorkspace,
  telemetry,
  resolveConfiguration
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

export enum DecisionCode {
  NeedToUpdate,
  AlreadyUpToDate,
  UserDeclined,
  ErrorOccured
}

export enum QmllsStatus {
  running,
  stopped
}

export async function setDoNotAskForDownloadingQmlls(value: boolean) {
  await vscode.workspace
    .getConfiguration(EXTENSION_ID)
    .update(
      'doNotAskForQmllsDownload',
      value,
      vscode.ConfigurationTarget.Global
    );
}

export function getDoNotAskForDownloadingQmlls(): boolean {
  return (
    vscode.workspace
      .getConfiguration(EXTENSION_ID)
      .get<boolean>('doNotAskForQmllsDownload') ?? false
  );
}

export async function fetchAssetAndDecide(options?: {
  doNotAsk?: true;
  silent?: boolean;
}): Promise<{
  code: DecisionCode;
  asset?: installer.AssetWithTag;
}> {
  const task = async (
    _?: vscode.Progress<{ message?: string; increment?: number }>,
    token?: vscode.CancellationToken
  ) => {
    try {
      logger.info('Fetching release information');
      const controller = new AbortController();
      token?.onCancellationRequested(() => {
        controller.abort();
      });
      const asset = await installer.fetchAssetToInstall(controller);
      if (!asset) {
        return { code: DecisionCode.UserDeclined };
      }
      const status = installer.checkStatusAgainst(asset);
      logger.info('Status Check: ', status.message);

      if (!status.shouldInstall) {
        return { code: DecisionCode.AlreadyUpToDate, asset };
      }

      if (options?.doNotAsk !== true) {
        if (!(await installer.getUserConsent())) {
          logger.info('User declined to install qmlls');
          return { code: DecisionCode.UserDeclined };
        }
      }
      telemetry.sendAction('UserConsentNewerVersionOfQmlls');
      return { code: DecisionCode.NeedToUpdate, asset };
    } catch (error) {
      logger.warn(isError(error) ? error.message : String(error));
      return { code: DecisionCode.ErrorOccured };
    }
  };
  if (options?.silent === true) {
    return task();
  }

  const progressOptions = {
    title: 'Fetching QML Language Server information',
    location: vscode.ProgressLocation.Notification,
    cancellable: true
  };
  return vscode.window.withProgress(progressOptions, task);
}

export class Qmlls {
  private _docsPath: string | undefined;
  private readonly _disposables: vscode.Disposable[] = [];
  private readonly _importPaths = new Set<string>();
  private _client: LanguageClient | undefined;
  private _channel: vscode.OutputChannel | undefined;
  private _buildDir: string | undefined;

  constructor(readonly _folder: vscode.WorkspaceFolder) {
    const eventHandler = vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(QMLLS_CONFIG, _folder)) {
        void this.restart();
      }
    });
    this._disposables.push(eventHandler);
  }
  dispose() {
    for (const d of this._disposables) {
      d.dispose();
    }
    void this._client?.dispose();
    this._channel?.dispose();
  }
  set buildDir(buildDir: string | undefined) {
    this._buildDir = buildDir;
  }
  get buildDir() {
    return this._buildDir;
  }

  addImportPath(importPath: string) {
    this._importPaths.add(importPath);
  }

  get docsPath() {
    return this._docsPath;
  }

  set docsPath(docsPath: string | undefined) {
    this._docsPath = docsPath;
  }

  removeImportPath(importPath: string) {
    this._importPaths.delete(importPath);
  }
  clearImportPaths() {
    this._importPaths.clear();
  }

  public static async install(
    asset: installer.AssetWithTag,
    options?: { restart: true }
  ) {
    try {
      if (options?.restart) {
        await projectManager.stopQmlls();
      }

      logger.info(`Installing: ${asset.name}, ${asset.tag_name}`);
      await installer.install(asset);
      logger.info('Installation done');
    } catch (error) {
      logger.warn(isError(error) ? error.message : String(error));
    }

    if (options?.restart) {
      void projectManager.startQmlls();
      return QmllsStatus.running;
    }
    return QmllsStatus.stopped;
  }
  public static async checkAssetAndDecide() {
    // Do not show the progress bar during the startup
    const result = await fetchAssetAndDecide({ silent: true });
    if (result.code === DecisionCode.NeedToUpdate && result.asset) {
      return Qmlls.install(result.asset);
    }
    return QmllsStatus.stopped;
  }

  public async start() {
    const configs = vscode.workspace.getConfiguration(
      QMLLS_CONFIG,
      this._folder
    );
    if (!configs.get<boolean>('enabled', false)) {
      return;
    }

    try {
      if (configs.get<string>('customExePath')) {
        const customPath = configs.get<string>('customExePath') ?? '';
        const untildifiedCustomPath = resolveConfiguration(customPath);
        const res = spawnSync(untildifiedCustomPath, ['--help'], {
          timeout: 1000
        });
        if (res.status !== 0) {
          throw res.error ?? new Error(res.stderr.toString());
        }
        telemetry.sendAction('customQmllsUsage');
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
    const configs = vscode.workspace.getConfiguration(
      QMLLS_CONFIG,
      this._folder
    );
    const verboseOutput = configs.get<boolean>('verboseOutput', false);
    const traceLsp = configs.get<string>('traceLsp', 'off');

    if (!this._channel) {
      this._channel = vscode.window.createOutputChannel(
        `QML Language Server - ${this._folder.name}`
      );
    }
    let args: string[] = [];
    const customArgs = configs.get<string[]>('customArgs', []);
    if (customArgs.length > 0) {
      args = customArgs.map((arg) => {
        return resolveConfiguration(arg);
      });
    } else {
      if (verboseOutput) {
        args.push('--verbose');
      }

      const useQmlImportPathEnvVar = configs.get<boolean>(
        'useQmlImportPathEnvVar',
        false
      );
      if (useQmlImportPathEnvVar) {
        args.push('-E');
      }

      if (this._buildDir) {
        args.push(`-b${this._buildDir}`);
      }

      const additionalImportPaths = configs.get<string[]>(
        'additionalImportPaths',
        []
      );

      let docsPath = configs.get<string>('customDocsPath', '');
      if (docsPath) {
        // If qt-qml.qmlls.customDocsPath is set, use it instead of the path from the kit
        docsPath = resolveConfiguration(docsPath);
      } else {
        docsPath = this.docsPath ?? '';
      }

      if (docsPath) {
        args.push(`-d${docsPath}`);
      }

      const toImportParam = (p: string) => {
        return `-I${p}`;
      };

      const resolvedAdditionalImportPaths = additionalImportPaths.map(
        (importPath) => {
          return resolveConfiguration(importPath);
        }
      );

      resolvedAdditionalImportPaths.forEach((importPath) => {
        args.push(toImportParam(importPath));
      });

      this._importPaths.forEach((importPath) =>
        args.push(toImportParam(importPath))
      );

      const useNoCMakeCalls = configs.get<boolean>('useNoCMakeCalls', false);
      if (useNoCMakeCalls) {
        args.push('--no-cmake-calls');
      }
    }

    logger.info('Starting QML Language Server with:', args.join(';'));
    const serverOptions: ServerOptions = {
      command: qmllsPath,
      args: args
    };

    const clientOptions: LanguageClientOptions = {
      documentSelector: [
        {
          language: 'qml',
          pattern: `${this._folder.uri.fsPath}/**/*`
        }
      ],
      workspaceFolder: this._folder,
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

        logger.info(
          `QML Language Server started for ${this._folder.name} ${qmllsPath}`
        );
        telemetry.sendEvent('QmllsStarted');
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

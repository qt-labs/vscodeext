// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import * as vscode from 'vscode';
import { spawnSync } from 'child_process';
import {
  Trace,
  State,
  ServerOptions,
  LanguageClient,
  LanguageClientOptions
} from 'vscode-languageclient/node.js';

import {
  createLogger,
  findQtKits,
  isError,
  OSExeSuffix,
  compareVersions,
  CoreKey,
  telemetry,
  resolveConfiguration,
  PySideEnvData,
  QtWorkspaceFeatures
} from 'qt-lib';
import { coreAPI, projectManager } from '@/extension.mjs';
import { EXTENSION_ID } from '@/constants.js';
import * as installer from '@/installer.mjs';
import { QmllsOperationType } from '@/qmlls-queue.mjs';

const logger = createLogger('qmlls');
const QMLLS_CONFIG = `${EXTENSION_ID}.qmlls`;
const QmllsStopTimeoutMs = 5000;

interface QmllsExeConfig {
  qmllsPath: string;
  qtVersion: string;
}

export enum DecisionCode {
  NeedToInstall,
  NeedToUpdate,
  AlreadyUpToDate,
  UserDeclined,
  ErrorOccured
}

enum QmllsStatus {
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

      if (status.status === installer.AssetStatus.UpToDate) {
        return { code: DecisionCode.AlreadyUpToDate, asset };
      }

      const needToInstall =
        status.status === installer.AssetStatus.NotInstalled;
      if (options?.doNotAsk !== true) {
        if (!(await installer.getUserConsent(needToInstall))) {
          logger.info('User declined to install qmlls');
          return { code: DecisionCode.UserDeclined };
        }
      }
      telemetry.sendAction(
        needToInstall
          ? 'UserConsentInstallQmlls'
          : 'UserConsentNewerVersionOfQmlls'
      );
      return {
        code: needToInstall
          ? DecisionCode.NeedToInstall
          : DecisionCode.NeedToUpdate,
        asset
      };
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

// A tag alone does not identify a build: new assets can be re-published
// under the same tag, so the upload time is part of the comparison.
function isSameVersion(
  a: installer.InstallVersion,
  b: installer.InstallVersion
): boolean {
  return a.tag === b.tag && a.createdAt === b.createdAt;
}

function describeVersion(
  version: installer.InstallVersion | undefined
): string {
  return version
    ? `${version.tag} (uploaded ${version.createdAt || 'unknown'})`
    : 'none';
}

/**
 * Watch the install manifest for versions published by other VS Code
 * instances and silently restart the language clients to adopt them. This is
 * best-effort: if the watcher never fires on some platform, the new version
 * is still picked up at the next natural (re)start, because the exe path is
 * resolved fresh from the manifest every time.
 */
export function registerQmllsManifestWatcher(): vscode.Disposable {
  const manifestPath = path.join(
    installer.getInstallRoot(),
    installer.ManifestFileName
  );
  logger.info(
    `Watching for qmlls versions published by other VS Code instances: ${manifestPath}`
  );
  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(
      vscode.Uri.file(installer.getInstallRoot()),
      installer.ManifestFileName
    )
  );
  let debounce: NodeJS.Timeout | undefined;
  const onManifestChanged = () => {
    if (debounce) {
      clearTimeout(debounce);
    }
    debounce = setTimeout(() => {
      debounce = undefined;
      const published = installer.getInstalledVersion();
      // Restarting with an unchanged manifest would only interrupt users:
      // the publisher is this instance (its install flow already restarts),
      // or the manifest vanished (start() would fall back to a Qt kit).
      if (
        !published ||
        !Qmlls.runningInstalledVersion ||
        isSameVersion(published, Qmlls.runningInstalledVersion)
      ) {
        logger.info(
          `Manifest changed but no restart is needed (published: ${describeVersion(published)}, running: ${describeVersion(Qmlls.runningInstalledVersion)})`
        );
        return;
      }
      logger.info(
        `qmlls ${describeVersion(published)} was published by another VS Code instance, restarting`
      );
      void projectManager.restartQmlls();
    }, 1000);
  };
  watcher.onDidCreate(onManifestChanged);
  watcher.onDidChange(onManifestChanged);
  return new vscode.Disposable(() => {
    if (debounce) {
      clearTimeout(debounce);
    }
    watcher.dispose();
  });
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

  /**
   * The identity of the managed qmlls install the language clients are
   * running from or adopting. Used by the manifest watcher to tell a version
   * published by another VS Code instance apart from our own install. The
   * upload time is part of the identity: a build re-published under the same
   * tag must still trigger a restart.
   */
  static runningInstalledVersion: installer.InstallVersion | undefined;

  public static async install(asset: installer.AssetWithTag) {
    try {
      // The new version is staged next to the running one, so the language
      // server keeps serving during the whole download and only restarts
      // once the new version is published.
      logger.info(`Installing: ${asset.name}, ${asset.tag_name}`);
      await installer.install(asset);
      logger.info('Installation done');

      // Adopt the version before the restart, not in start(): the manifest
      // watcher's debounce can fire while the restart is still stopping the
      // old server, and must not mistake our own publish for one made by
      // another VS Code instance.
      Qmlls.runningInstalledVersion = {
        tag: asset.tag_name,
        createdAt: asset.created_at
      };
      logger.info(
        `Adopted qmlls ${describeVersion(Qmlls.runningInstalledVersion)}, restarting`
      );

      projectManager.updateQmllsParams();
      await projectManager.restartQmlls();
    } catch (error) {
      logger.warn(isError(error) ? error.message : String(error));
    }

    return QmllsStatus.running;
  }
  public static checkAssetAndDecide() {
    // Do not show the progress bar during the startup
    void fetchAssetAndDecide({ silent: true }).then((result) => {
      if (
        (result.code === DecisionCode.NeedToInstall ||
          result.code === DecisionCode.NeedToUpdate) &&
        result.asset
      ) {
        logger.info(
          result.code === DecisionCode.NeedToInstall
            ? 'Installing QML language server'
            : 'Updating QML language server'
        );
        // Install and start are queued - no need to await
        void Qmlls.install(result.asset);
      }
    });
  }

  public async start() {
    const configs = vscode.workspace.getConfiguration(
      QMLLS_CONFIG,
      this._folder
    );
    if (this._client?.needsStop()) {
      logger.info('QML Language Server is already running or starting');
      return;
    }
    if (!configs.get<boolean>('enabled', false)) {
      telemetry.sendConfig('QmllsDisabled');
      logger.info('QML Language Server is disabled in the settings');
      return;
    }

    try {
      if (configs.get<string>('customExePath')) {
        const customPath = configs.get<string>('customExePath') ?? '';
        const resolvedCustomPath = resolveConfiguration(customPath);
        const res = spawnSync(resolvedCustomPath, ['--help'], {
          timeout: 1000
        });
        if (res.status !== 0) {
          throw res.error ?? new Error(res.stderr.toString());
        }
        telemetry.sendAction('customQmllsUsage');
        logger.info(`Using custom qmlls: ${resolvedCustomPath}`);
        this.startLanguageClient(resolvedCustomPath);
      } else {
        // Resolved fresh on every start: another VS Code instance may have
        // published a new version since the last one.
        const installed = installer.resolveQmllsExePath();
        if (installed) {
          const version = installer.getInstalledVersion();
          Qmlls.runningInstalledVersion = version;
          logger.info(
            `Using managed qmlls ${describeVersion(version)}: ${installed}`
          );
          this.startLanguageClient(installed);
          return;
        }
        logger.info(
          'No managed qmlls installed, looking for one in the Qt kits'
        );

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

        logger.info(
          `Using qmlls from Qt ${qmllsExeConfig.qtVersion}: ${qmllsExeConfig.qmllsPath}`
        );
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

      if (coreAPI) {
        const workspaceFeatures = coreAPI.getValue<QtWorkspaceFeatures>(
          this._folder,
          CoreKey.WORKSPACE_FEATURES
        );

        const pysideEnv = coreAPI.getValue<PySideEnvData>(
          this._folder,
          CoreKey.PYSIDE_ENV_DATA
        );

        if (
          workspaceFeatures?.projectTypes.pyside &&
          pysideEnv?.qmlImportPath
        ) {
          additionalImportPaths.push(pysideEnv.qmlImportPath);
        }
      }

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
      if (this._client.needsStop()) {
        logger.info(`Stopping QML Language Server: "${this._folder.name}"`);
        // LanguageClient.stop() throws when called in the "starting" state.
        // Calling start() on an already-starting client is idempotent — it
        // returns the existing in-progress promise, letting us wait for the
        // startup to complete before we can safely call stop().
        if (this._client.state === State.Starting) {
          logger.info(
            `Waiting for QML Language Server to finish starting before stopping: "${this._folder.name}"`
          );
          try {
            await this._client.start();
          } catch {
            // If start fails, the client transitions to StartFailed state
            // and no longer needs to be stopped.
          }
        }
        if (this._client.isRunning()) {
          // A busy qmlls (e.g. mid-indexing) often needs more than the
          // default 2s to answer the shutdown handshake. On timeout the
          // client force-kills the server, so this failure is recoverable
          // and only logged as a warning.
          await this._client
            .stop(QmllsStopTimeoutMs)
            .then(() => {
              logger.info(
                `QML Language Server stopped: "${this._folder.name}"`
              );
            })
            .catch((e: unknown) => {
              logger.warn(
                `QML Language Server stop failed: "${this._folder.name}", ${String(e)}`
              );
            });
        }
      }

      this._client = undefined;
    }

    if (this._channel) {
      this._channel.dispose();
      this._channel = undefined;
    }
  }

  /**
   * Internal restart method - does not go through the queue.
   * Use this when already inside a queued operation.
   */
  async _restartInternal() {
    await this.stop();
    await this.start();
  }

  /**
   * Restart the language server. This goes through the operation queue
   * to prevent race conditions with install/update operations.
   */
  public async restart() {
    return projectManager.qmllsQueue.enqueue(
      QmllsOperationType.Restart,
      async () => {
        await this._restartInternal();
      }
    );
  }
}

async function findMostRecentExecutableQmlLS(): Promise<
  QmllsExeConfig | undefined
> {
  const allQtInsRootDirs: string[] = [];
  for (const project of projectManager.getProjects()) {
    const qtInsRoot = coreAPI?.getValue<string>(
      project.folder,
      CoreKey.QT_INSTALLATION_ROOT
    );
    if (qtInsRoot) {
      allQtInsRootDirs.push(qtInsRoot);
    }
  }
  const globalQtInsRoot = coreAPI?.getValue<string>(
    CoreKey.GLOBAL_WORKSPACE,
    CoreKey.QT_INSTALLATION_ROOT
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
    (casted.path ?? '') +
    ', ' +
    `${KnownErrors[casted.code] ?? 'Error'} (${casted.code})`
  );
}

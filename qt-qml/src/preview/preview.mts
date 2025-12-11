// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import getPort from 'get-port';

import { createLogger, telemetry } from 'qt-lib';
import { EXTENSION_ID } from '@/constants.js';
import { projectManager } from '@/extension.mjs';
import { QmlPreviewConnectionManager } from '@/preview/preview-connection-manager.mjs';
import { FpsInfo } from '@/preview/preview-client.mjs';
import { ServerScheme } from '@debug/debug-connection.mjs';
import { QtProcess, spawnProcessForTool } from '@/utils.mts';
import { QmlPreviewUI } from '@preview/ui.js';

const logger = createLogger('qml-preview');
const ui = new QmlPreviewUI();

let qmlPreviewOutputChannel: vscode.OutputChannel | undefined;
let previewManager: QmlPreviewConnectionManager | undefined;
let previewProcess: QtProcess | undefined;

function isConnected() {
  return previewManager?.isConnected() ?? false;
}

function cleanupSession() {
  previewManager?.dispose();
  previewManager = undefined;
  previewProcess?.kill();
  previewProcess = undefined;
  ui.setPreviewStopped();
}

function createPreviewManager() {
  const manager = new QmlPreviewConnectionManager();
  manager.setupFileWatcher();

  const additionalBuildDirs = getPreviewConfig().get<string[]>(
    'additionalBuildDirs',
    []
  );
  const projectBuildDirs = projectManager.getBuildDirs();
  manager.buildDirs = [...projectBuildDirs, ...additionalBuildDirs];

  return manager;
}

async function resolveProgram() {
  const ret = await vscode.commands.executeCommand('cmake.launchTargetPath');
  return ret as string | undefined;
}

function buildPreviewArgs(host: string, port: number) {
  return `-qmljsdebugger=host:${host},port:${port},block,services:QmlPreview,DebugTranslation`;
}

function getPreviewConfig() {
  return vscode.workspace.getConfiguration('qt-qml.preview');
}

async function launchPreview(qmlFile?: string) {
  const program = await resolveProgram();
  if (!program) {
    logger.error('Failed to get launch target executable');
    ui.showFailedToStart(new Error('No launch target configured'));
    return false;
  }
  logger.info(`Program: ${program}`);

  const host = '127.0.0.1';
  const port = await getPort();
  if (!port) {
    logger.error('Failed to obtain a free port');
    ui.showFailedToStart(new Error('Failed to obtain a free port'));
    return false;
  }
  logger.info(`Host: ${host}, Port: ${port}`);

  const manager = createPreviewManager();

  manager.onConnectionClosed(() => {
    logger.info('QML Preview connection closed');
    cleanupSession();
  });
  manager.setFpsHandler((fps: FpsInfo) => {
    ui.updateFps(fps);
  });

  const previewArgs = buildPreviewArgs(host, port);
  const additionalArgs = getPreviewConfig().get<string[]>('args', []);
  const command = `${program} ${previewArgs}`;
  logger.info(`Command: ${command} ${additionalArgs.join(' ')}`);

  try {
    const process = await spawnProcessForTool(command, additionalArgs);

    if (process.killed || process.pid === undefined) {
      logger.error('Failed to start QML Preview process');
      manager.dispose();
      ui.showFailedToStart(new Error('Process failed to start'));
      return false;
    }
    logger.info(`QML Preview process started with PID: ${process.pid}`);

    // Set up output channel
    if (!qmlPreviewOutputChannel) {
      qmlPreviewOutputChannel =
        vscode.window.createOutputChannel('QML Preview Output');
    }

    process.stdout?.on('data', (data: Buffer) => {
      qmlPreviewOutputChannel?.append(data.toString());
    });

    process.stderr?.on('data', (data: Buffer) => {
      qmlPreviewOutputChannel?.append(data.toString());
    });

    process.on('exit', (code, signal) => {
      logger.info(
        `QML Preview process exited with code ${code}, signal ${signal}`
      );
      cleanupSession();
    });

    // Helper promises for connection establishment
    const waitForConnection = async () => {
      const connectionReady = new Promise<void>((resolve) => {
        const disposable = manager.onConnectionOpened(() => {
          disposable.dispose();
          resolve();
        });
      });

      const timeout = new Promise<void>((_, reject) => {
        setTimeout(() => {
          reject(new Error('QML Preview connection timeout after 10 seconds'));
        }, 10000);
      });
      return Promise.race([connectionReady, timeout]);
    };

    previewManager = manager;
    previewProcess = process;

    manager.connectToServer({ host, port, scheme: ServerScheme.Tcp });
    logger.info('QML Preview connected successfully');

    // If a QML file was specified, wait for connection and load it
    if (qmlFile) {
      logger.info('Waiting for QML Preview connection to be ready...');
      try {
        await waitForConnection();
        logger.info(`Loading QML file: ${qmlFile}`);
        manager.loadUrl(qmlFile);
      } catch (err) {
        logger.error(`Timeout waiting for connection: ${String(err)}`);
      }
    }

    ui.setPreviewRunning();
    return true;
  } catch (err) {
    logger.error(`Failed to start QML Preview: ${String(err)}`);
    manager.dispose();
    ui.showFailedToStart(err instanceof Error ? err : new Error(String(err)));
    return false;
  }
}

function attachPreview(host: string, port: number) {
  logger.info(`Attaching to ${host}:${port}...`);

  const manager = createPreviewManager();

  manager.onConnectionClosed(() => {
    logger.info('QML Preview connection closed in attach mode');
    cleanupSession();
  });
  manager.onConnectionOpened(() => {
    logger.info('QML Preview connection opened');
    ui.setPreviewRunning();
    ui.showAttachSuccess(host, port);
  });
  manager.onConnectionFailed(() => {
    logger.info('QML Preview connection failed');
    ui.showFailedToAttach(new Error('Connection failed'));
    cleanupSession();
  });
  manager.onDebugServiceUnavailable(() => {
    logger.info('QML Preview debug service unavailable in attach mode');
    cleanupSession();
  });

  try {
    previewManager = manager;
    manager.connectToServer({ host, port, scheme: ServerScheme.Tcp });
    logger.info(`Waiting for connection to ${host}:${port}...`);
    return true;
  } catch (err) {
    logger.error(`Failed to attach to QML Preview: ${String(err)}`);
    manager.dispose();
    previewManager = undefined;
    return false;
  }
}

async function startQmlPreviewImpl(loadCurrentFile: boolean) {
  if (isConnected()) {
    ui.showAlreadyRunning();
    return;
  }

  let qmlFile: string | undefined;

  if (loadCurrentFile) {
    const activeEditor = vscode.window.activeTextEditor;
    if (
      activeEditor &&
      (activeEditor.document.languageId === 'qml' ||
        activeEditor.document.fileName.endsWith('.qml'))
    ) {
      qmlFile = activeEditor.document.uri.fsPath;
      logger.info('Current QML file:', qmlFile);
    } else {
      void vscode.window.showWarningMessage(
        'No QML file is currently open. Please open a QML file to preview.'
      );
      return;
    }
  }

  await launchPreview(qmlFile);
}

export function registerStartQmlPreviewCommand() {
  return vscode.commands.registerCommand(
    `${EXTENSION_ID}.startQmlPreview`,
    async () => {
      logger.info('Starting QML Preview');
      telemetry.sendAction('startQmlPreview');
      await startQmlPreviewImpl(false);
    }
  );
}

export function registerStartQmlPreviewForCurrentFileCommand() {
  return vscode.commands.registerCommand(
    `${EXTENSION_ID}.startQmlPreviewForCurrentFile`,
    async () => {
      logger.info('Starting QML Preview for current file');
      telemetry.sendAction('startQmlPreviewForCurrentFile');
      await startQmlPreviewImpl(true);
    }
  );
}

export function registerAttachQmlPreviewCommand() {
  return vscode.commands.registerCommand(
    `${EXTENSION_ID}.attachQmlPreview`,
    async () => {
      logger.info('Attaching to QML Preview');
      telemetry.sendAction('attachQmlPreview');

      if (isConnected()) {
        ui.showAlreadyRunning();
        return;
      }

      const connectionInfo = await ui.promptForConnectionInfo();
      if (!connectionInfo) {
        return;
      }

      void ui.showWaitingForConnection(
        connectionInfo.host,
        connectionInfo.port,
        () => {
          logger.info('User canceled connection attempt');
          previewManager?.cancelConnection();
          cleanupSession();
        }
      );

      attachPreview(connectionInfo.host, connectionInfo.port);
    }
  );
}

export function registerStopQmlPreviewCommand() {
  return vscode.commands.registerCommand(
    `${EXTENSION_ID}.stopQmlPreview`,
    () => {
      telemetry.sendAction('stopQmlPreview');

      if (!previewManager) {
        ui.showNotRunning();
        return;
      }

      if (previewProcess) {
        logger.info(
          `Killing QML Preview process with PID: ${previewProcess.pid}`
        );
      }

      cleanupSession();
    }
  );
}

export function registerReloadQmlPreviewCommand() {
  return vscode.commands.registerCommand(
    `${EXTENSION_ID}.reloadQmlPreview`,
    () => {
      telemetry.sendAction('reloadQmlPreview');

      if (!previewManager?.isConnected()) {
        ui.showNotConnected();
        return;
      }

      previewManager.rerun();
      ui.showReloaded();
    }
  );
}

export function registerClearQmlPreviewCacheCommand() {
  return vscode.commands.registerCommand(
    `${EXTENSION_ID}.clearQmlPreviewCache`,
    () => {
      telemetry.sendAction('clearQmlPreviewCache');

      if (!previewManager?.isConnected()) {
        ui.showNotConnected();
        return;
      }

      previewManager.clearCache();
      ui.showCacheCleared();
    }
  );
}

export function disposePreviewManager() {
  cleanupSession();
}

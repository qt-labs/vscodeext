// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import * as vscode from 'vscode';
import { type ChildProcess } from 'child_process';
import getPort from 'get-port';

import {
  createLogger,
  telemetry,
  PySideProject,
  QtWorkspaceFeatures,
  CoreKey
} from 'qt-lib';
import { EXTENSION_ID } from '@/constants.js';
import { projectManager, coreAPI } from '@/extension.mjs';
import { QmlPreviewConnectionManager } from '@/preview/preview-connection-manager.mjs';
import { FpsInfo } from '@/preview/preview-client.mjs';
import { ServerScheme } from '@debug/debug-connection.mjs';
import { QtProcess, spawnProcessForTool } from '@/utils.mts';
import { QmlPreviewUI } from '@preview/ui.js';
import { QMLProject } from '@/project.mjs';

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

async function resolveCMakeProgram() {
  const ret = await vscode.commands.executeCommand('cmake.launchTargetPath');
  return ret as string | undefined;
}

function buildPreviewArgs(host: string, port: number) {
  return `-qmljsdebugger=host:${host},port:${port.toString()},block,services:QmlPreview,DebugTranslation`;
}

function getPreviewConfig() {
  return vscode.workspace.getConfiguration('qt-qml.preview');
}

/**
 * Resolve which workspace folder to use for preview.
 * For "preview current file": use the active file's workspace folder.
 * For "preview whole application": use active file's folder, or if ambiguous
 * in multi-workspace, show a picker.
 */
async function resolveWorkspaceFolder(
  requirePick: boolean
): Promise<vscode.WorkspaceFolder | undefined> {
  const activeUri = vscode.window.activeTextEditor?.document.uri;
  if (activeUri) {
    const folder = vscode.workspace.getWorkspaceFolder(activeUri);
    if (folder) {
      return folder;
    }
  }

  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return undefined;
  }

  if (folders.length === 1) {
    return folders[0];
  }

  if (requirePick) {
    const picked = await vscode.window.showWorkspaceFolderPick({
      placeHolder: 'Select the workspace folder for QML Preview'
    });
    return picked;
  }

  return folders[0];
}

/**
 * Determine the project type for the given workspace folder.
 */
function getProjectType(
  folder: vscode.WorkspaceFolder
): 'cmake' | 'pyside' | undefined {
  const project = projectManager.getProject(folder);
  if (project?.pySideProject) {
    return 'pyside';
  }

  const features = coreAPI?.getValue<QtWorkspaceFeatures>(
    folder,
    CoreKey.WORKSPACE_FEATURES
  );
  if (features?.projectTypes.cmake) {
    return 'cmake';
  }
  if (features?.projectTypes.pyside) {
    return 'pyside';
  }

  return undefined;
}

async function launchCMakePreview(qmlFile?: string) {
  const program = await resolveCMakeProgram();
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
  logger.info(`Host: ${host}, Port: ${port.toString()}`);

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
    logger.info(
      `QML Preview process started with PID: ${process.pid.toString()}`
    );

    setupProcessForPreview(process, manager, qmlFile, host, port);
    return true;
  } catch (err) {
    logger.error(`Failed to start QML Preview: ${String(err)}`);
    manager.dispose();
    ui.showFailedToStart(err instanceof Error ? err : new Error(String(err)));
    return false;
  }
}

/**
 * Pick a Python file entry point for PySide preview.
 *
 * The workspace folder is already resolved from the active QML file, so only
 * Python files belonging to that folder's project are shown.
 *
 * @param currentProject The PySide project for the target folder.
 * @returns The relative path of the selected file, or undefined on cancel.
 */
async function pickPythonFile(
  project: QMLProject,
  currentProject: PySideProject
): Promise<string | undefined> {
  const pyFiles = await currentProject.findPythonFiles();
  if (pyFiles.length === 0) {
    ui.showFailedToStart(new Error('No Python files found in the project'));
    return undefined;
  }
  if (pyFiles.length === 1) {
    return pyFiles[0];
  }

  const items = pyFiles.map((file) => ({
    label: path.basename(file),
    description: path.join(project.folder.name, path.dirname(file)),
    file: file,
    folder: project.folder
  }));
  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select the Python file that has the main function',
    title: 'QML preview - select entry point'
  });
  if (!selected) {
    logger.info('User cancelled file selection');
  }
  return selected?.file;
}

async function launchPySidePreview(
  folder: vscode.WorkspaceFolder,
  qmlFile?: string
) {
  const host = '127.0.0.1';
  const port = await getPort();
  if (!port) {
    logger.error('Failed to obtain a free port');
    ui.showFailedToStart(new Error('Failed to obtain a free port'));
    return false;
  }
  logger.info(`Host: ${host}, Port: ${String(port)}`);

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
  const allArgs = [previewArgs, ...additionalArgs];

  try {
    let proc: ChildProcess | undefined;
    const project = projectManager.getProject(folder);
    const pySideProject = project?.pySideProject;
    if (!pySideProject) {
      throw new Error('No PySide project found for the workspace folder');
    }
    if (pySideProject.supportsProjectRunArgs()) {
      // PySide >= 6.10.3: pass args via pyside6-project run <args>
      logger.info('Using pyside6-project run with args');
      proc = pySideProject.runProject(allArgs);
    } else {
      // PySide < 6.10.3: let user pick the main Python file
      logger.info(
        'PySide version does not support run args, using file picker'
      );

      const selectedFile = await pickPythonFile(project, pySideProject);
      if (!selectedFile) {
        manager.dispose();
        return false;
      }

      const absFilePath = path.isAbsolute(selectedFile)
        ? selectedFile
        : path.join(folder.uri.fsPath, selectedFile);
      logger.info(`Selected main file: ${absFilePath}`);

      logger.info('Building PySide project before running file...');
      const buildOk = await pySideProject.build();
      if (buildOk !== 0) {
        logger.error('PySide project build failed');
        manager.dispose();
        ui.showFailedToStart(new Error('pyside6-project build failed'));
        return false;
      }

      proc = pySideProject.runFile(absFilePath, allArgs);
    }

    if (!proc || proc.killed || proc.pid === undefined) {
      logger.error('Failed to start PySide preview process');
      manager.dispose();
      ui.showFailedToStart(new Error('Process failed to start'));
      return false;
    }
    logger.info(`PySide preview process started with PID: ${String(proc.pid)}`);

    setupProcessForPreview(proc, manager, qmlFile, host, port);
    return true;
  } catch (err) {
    logger.error(`Failed to start PySide preview: ${String(err)}`);
    manager.dispose();
    ui.showFailedToStart(err instanceof Error ? err : new Error(String(err)));
    return false;
  }
}

/**
 * Common process setup for both CMake and PySide preview.
 */
function setupProcessForPreview(
  proc: ChildProcess | QtProcess,
  manager: QmlPreviewConnectionManager,
  qmlFile: string | undefined,
  host: string,
  port: number
) {
  // Set up output channel
  if (!qmlPreviewOutputChannel) {
    qmlPreviewOutputChannel =
      vscode.window.createOutputChannel('QML Preview Output');
  }

  proc.stdout?.on('data', (data: Buffer) => {
    qmlPreviewOutputChannel?.append(data.toString());
  });

  proc.stderr?.on('data', (data: Buffer) => {
    qmlPreviewOutputChannel?.append(data.toString());
  });

  proc.on('exit', (code, signal) => {
    logger.info(
      `QML Preview process exited with code ${String(code)}, signal ${String(signal)}`
    );
    cleanupSession();
  });

  previewManager = manager;
  previewProcess = proc as QtProcess;

  manager.connectToServer({ host, port, scheme: ServerScheme.Tcp });
  logger.info('QML Preview connected successfully');

  // If a QML file was specified, wait for connection and load it
  if (qmlFile) {
    logger.info('Waiting for QML Preview connection to be ready...');
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

    void waitForConnection()
      .then(() => {
        logger.info(`Loading QML file: ${qmlFile}`);
        manager.loadUrl(qmlFile);
      })
      .catch((err: unknown) => {
        logger.error(`Timeout waiting for connection: ${String(err)}`);
      });
  }

  ui.setPreviewRunning();
}

function attachPreview(host: string, port: number) {
  logger.info(`Attaching to ${host}:${port.toString()}...`);

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
    logger.info(`Waiting for connection to ${host}:${port.toString()}...`);
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

  // Resolve the workspace folder.
  // For "preview current file": get folder from active file.
  // For "preview whole application" in multi-workspace: show picker.
  const requirePick = !loadCurrentFile;
  const folder = await resolveWorkspaceFolder(requirePick);
  if (!folder) {
    void vscode.window.showWarningMessage(
      'No workspace folder available for QML Preview.'
    );
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

  const projectType = getProjectType(folder);
  logger.info(`Project type for ${folder.name}: ${projectType ?? 'unknown'}`);

  if (projectType === 'pyside') {
    const project = projectManager.getProject(folder);
    const pySideProject = project?.pySideProject;
    if (!pySideProject) {
      logger.error(`No PySide project found for folder: ${folder.uri.fsPath}`);
      void vscode.window.showErrorMessage(
        'No PySide project found in the workspace folder.'
      );
      return;
    }
    await launchPySidePreview(folder, qmlFile);
  } else {
    // Default to CMake preview (existing behavior)
    await launchCMakePreview(qmlFile);
  }
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

      if (previewProcess?.pid) {
        logger.info(
          `Killing QML Preview process with PID: ${previewProcess.pid.toString()}`
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

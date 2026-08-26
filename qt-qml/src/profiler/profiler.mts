// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import getPort from 'get-port';

import {
  createLogger,
  telemetry,
  PySideProject,
  QtWorkspaceFeatures,
  CoreKey,
  getQtQmlApi,
  type QtBridgePreviewLaunch,
  type QtBridgeProject
} from 'qt-lib';
import { EXTENSION_ID } from '@/constants.js';
import { projectManager, coreAPI } from '@/extension.mjs';
import { QmlProfilerConnectionManager } from './profiler-connection-manager.mjs';
import { ServerScheme } from '@debug/debug-connection.mjs';
import {
  QtProcess,
  spawnProcessForTool,
  spawnProgramForTool
} from '@/utils.mts';
import { QmlProfilerUI } from './ui.js';
import { getQtBridgeProjects, QMLProject } from '@/project.mjs';
import {
  getQtBridgePreviewProjects,
  isQtBridgePreviewAvailable,
  selectQtBridgePreviewProject
} from '@/preview/qtbridge-preview-project.mjs';

const logger = createLogger('qml-profiler');
const ui = new QmlProfilerUI();

let profilerManager: QmlProfilerConnectionManager | undefined;
let profilerProcess: QtProcess | undefined;
let profilerLaunch: QtBridgePreviewLaunch | undefined;
let profilerOutputChannel: vscode.OutputChannel | undefined;
let profilerStartPromise: Promise<void> | undefined;

// ─────────────────────────────── state ───────────────────────────────────────

function isProfilerStartingOrRunning() {
  return (
    profilerStartPromise !== undefined ||
    profilerManager !== undefined ||
    profilerProcess !== undefined
  );
}

function cleanupSession() {
  profilerManager?.dispose();
  profilerManager = undefined;
  profilerProcess?.kill();
  profilerProcess = undefined;
  profilerLaunch?.dispose();
  profilerLaunch = undefined;
  ui.setProfilerStopped();
}

// ─────────────────────────── trace file naming ───────────────────────────────

/**
 * Build a trace file path in the OS temp directory.
 * Format: <outputDir>/<baseName>_YYYYMMDD_HHmmss.qtd
 */
function buildTraceFilePath(baseName: string, outputDir: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const datePart = `${String(now.getFullYear())}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const timePart = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  // sanitise the base name: replace non-alphanumeric chars with underscores
  const safe = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(outputDir, `${safe}_${datePart}_${timePart}.qtd`);
}

/**
 * Resolve the output directory for trace files.
 * Prefer the first workspace folder, fall back to OS temp.
 */
function resolveTraceOutputDir(folder?: vscode.WorkspaceFolder): string {
  if (folder) {
    return folder.uri.fsPath;
  }
  return os.tmpdir();
}

// ─────────────────────────── helpers ─────────────────────────────────────────

function buildProfilerArgs(host: string, port: number) {
  return `-qmljsdebugger=host:${host},port:${String(port)},block,services:CanvasFrameRate`;
}

function getProfilerConfig() {
  return vscode.workspace.getConfiguration('qt-qml.profiler');
}

async function resolveCMakeProgram() {
  const ret = await vscode.commands.executeCommand('cmake.launchTargetPath');
  return ret as string | undefined;
}

/** Determine the project type for the given workspace folder. */
function getProjectType(
  folder: vscode.WorkspaceFolder,
  bridgeProject?: QtBridgeProject
): 'bridge' | 'cmake' | 'pyside' | undefined {
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
  if (isQtBridgePreviewAvailable(bridgeProject)) {
    return 'bridge';
  }
  return undefined;
}

/**
 * Resolve which workspace folder to use.
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
    return vscode.window.showWorkspaceFolderPick({
      placeHolder: 'Select the workspace folder for QML Profiler'
    });
  }
  return folders[0];
}

// ─────────────────────────── launch helpers ───────────────────────────────────

function createProfilerManager() {
  return new QmlProfilerConnectionManager();
}

/**
 * Common process + connection setup (used by both CMake and PySide launches).
 *
 * @param proc     The spawned child process running the Qt application
 * @param manager  The already-created connection manager
 * @param host     TCP host
 * @param port     TCP port
 * @param traceName  Basename for the trace file (without path or extension)
 * @param folder   Workspace folder (for output directory)
 */
function setupProcessForProfiler(
  proc: QtProcess,
  manager: QmlProfilerConnectionManager,
  host: string,
  port: number,
  traceName: string,
  folder: vscode.WorkspaceFolder | undefined
) {
  if (!profilerOutputChannel) {
    profilerOutputChannel = vscode.window.createOutputChannel(
      'QML Profiler Output'
    );
  }

  proc.stdout?.on('data', (data: Buffer) => {
    profilerOutputChannel?.append(data.toString());
  });
  proc.stderr?.on('data', (data: Buffer) => {
    profilerOutputChannel?.append(data.toString());
  });
  proc.on('exit', (code, signal) => {
    logger.info(
      `QML Profiler process exited (code=${String(code)}, signal=${String(signal)})`
    );
    cleanupSession();
  });

  profilerManager = manager;
  profilerProcess = proc;

  // Wire up trace completion
  manager.onRecordingCompleted(() => {
    void onRecordingCompleted(manager, traceName, folder);
  });

  manager.onConnectionClosed(() => {
    logger.info('QML Profiler connection closed');
    cleanupSession();
  });

  manager.onServiceUnavailable(() => {
    logger.warn('QML Profiler service unavailable');
    cleanupSession();
  });

  manager.connectToServer({ host, port, scheme: ServerScheme.Tcp });

  // Auto-start recording once we are connected
  const disposable = manager.onConnectionOpened(() => {
    disposable.dispose();
    logger.info('Auto-starting recording after connection');
    manager.startRecording();
    ui.setProfilerRecording();
  });

  ui.setProfilerRunning();
}

async function onRecordingCompleted(
  manager: QmlProfilerConnectionManager,
  traceName: string,
  folder: vscode.WorkspaceFolder | undefined
) {
  if (!manager.hasTraceData) {
    ui.showNoTraceData();
    cleanupSession();
    return;
  }

  const outputDir = resolveTraceOutputDir(folder);
  const filePath = buildTraceFilePath(traceName, outputDir);

  try {
    manager.writeTrace(filePath);
  } catch (err) {
    logger.error('Failed to write trace file:', String(err));
    ui.showError(`Failed to save trace file: ${String(err)}`);
    cleanupSession();
    return;
  }

  cleanupSession();

  // Automatically open the trace file in the profiler viewer
  const api = (await getQtQmlApi())?.traceFile;
  if (api) {
    api.open(vscode.Uri.file(filePath));
  }
}

// ─────────────────────────── CMake launch ────────────────────────────────────

async function launchCMakeProfiler(
  folder: vscode.WorkspaceFolder | undefined
): Promise<boolean> {
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

  const manager = createProfilerManager();
  const profilerArgs = buildProfilerArgs(host, port);
  const additionalArgs = getProfilerConfig().get<string[]>('args', []);
  const command = `${program} ${profilerArgs}`;
  logger.info(`Command: ${command} ${additionalArgs.join(' ')}`);

  // Derive trace base name from executable (e.g. "/path/to/myapp" -> "myapp")
  const traceName = path.basename(program, path.extname(program));

  try {
    const proc = await spawnProcessForTool(command, additionalArgs);
    if (proc.killed || proc.pid === undefined) {
      logger.error('Failed to start profiler process');
      manager.dispose();
      ui.showFailedToStart(new Error('Process failed to start'));
      return false;
    }
    logger.info(`Profiler process PID: ${String(proc.pid)}`);
    setupProcessForProfiler(proc, manager, host, port, traceName, folder);
    return true;
  } catch (err) {
    logger.error(`Failed to start QML Profiler: ${String(err)}`);
    manager.dispose();
    ui.showFailedToStart(err instanceof Error ? err : new Error(String(err)));
    return false;
  }
}

// ─────────────────────────── PySide launch ───────────────────────────────────

async function pickPythonFile(
  project: QMLProject,
  pySideProject: PySideProject
): Promise<string | undefined> {
  const pyFiles = await pySideProject.findPythonFiles();
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
    file
  }));
  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select the Python file that has the main function',
    title: 'QML Profiler – select entry point'
  });
  return selected?.file;
}

async function launchPySideProfiler(
  folder: vscode.WorkspaceFolder
): Promise<boolean> {
  const host = '127.0.0.1';
  const port = await getPort();
  if (!port) {
    logger.error('Failed to obtain a free port');
    ui.showFailedToStart(new Error('Failed to obtain a free port'));
    return false;
  }

  const manager = createProfilerManager();
  const profilerArgs = buildProfilerArgs(host, port);
  const additionalArgs = getProfilerConfig().get<string[]>('args', []);
  const allArgs = [profilerArgs, ...additionalArgs];

  try {
    const project = projectManager.getProject(folder);
    const pySideProject = project?.pySideProject;
    if (!pySideProject) {
      throw new Error('No PySide project found for the workspace folder');
    }

    let traceName = `pyside_${folder.name}`;

    if (pySideProject.supportsProjectRunArgs()) {
      logger.info('Using pyside6-project run with args');
      profilerProcess = pySideProject.runProject(allArgs);
    } else {
      logger.info('Replicating pyside6-project run manually');
      let absFilePath: string | undefined = await pySideProject.getMainFile();
      if (absFilePath) {
        logger.info(`Auto-detected main file: ${absFilePath}`);
        traceName = `pyside_${path.basename(absFilePath, '.py')}`;
      } else {
        const selectedFile = await pickPythonFile(project, pySideProject);
        if (!selectedFile) {
          manager.dispose();
          return false;
        }
        absFilePath = path.isAbsolute(selectedFile)
          ? selectedFile
          : path.join(folder.uri.fsPath, selectedFile);
        traceName = `pyside_${path.basename(absFilePath, '.py')}`;
        logger.info(`Selected main file: ${absFilePath}`);
      }

      logger.info('Building PySide project…');
      const buildOk = await pySideProject.build();
      if (buildOk !== 0) {
        logger.error('PySide project build failed');
        manager.dispose();
        ui.showFailedToStart(new Error('pyside6-project build failed'));
        return false;
      }
      profilerProcess = pySideProject.runFile(absFilePath, allArgs);
    }

    if (
      !profilerProcess ||
      profilerProcess.killed ||
      profilerProcess.pid === undefined
    ) {
      logger.error('Failed to start PySide profiler process');
      manager.dispose();
      ui.showFailedToStart(new Error('Process failed to start'));
      return false;
    }
    logger.info(`PySide profiler process PID: ${String(profilerProcess.pid)}`);
    setupProcessForProfiler(
      profilerProcess,
      manager,
      host,
      port,
      traceName,
      folder
    );
    return true;
  } catch (err) {
    logger.error(`Failed to start PySide QML Profiler: ${String(err)}`);
    manager.dispose();
    ui.showFailedToStart(err instanceof Error ? err : new Error(String(err)));
    return false;
  }
}

async function launchQtBridgeProfiler(
  folder: vscode.WorkspaceFolder,
  bridgeProject: QtBridgeProject
): Promise<boolean> {
  const metadata = bridgeProject.metadata;
  if (!metadata || !bridgeProject.isMetadataReady || !metadata.application) {
    logger.error(
      `Qt Bridge profiling is unavailable for folder: ${folder.uri.fsPath}`
    );
    ui.showFailedToStart(
      new Error('Qt Bridge build metadata is not available yet')
    );
    return false;
  }

  const host = '127.0.0.1';
  const port = await getPort();
  if (!port) {
    logger.error('Failed to obtain a free port');
    ui.showFailedToStart(new Error('Failed to obtain a free port'));
    return false;
  }

  const manager = createProfilerManager();
  let launch: QtBridgePreviewLaunch | undefined;
  try {
    launch = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Preparing Qt Bridge QML Profiler...'
      },
      async () => bridgeProject.prepareQmlPreview()
    );
    if (!launch) {
      throw new Error('Could not resolve Qt Bridge host executable');
    }

    const profilerArgs = buildProfilerArgs(host, port);
    const additionalArgs = getProfilerConfig().get<string[]>('args', []);
    const processArgs = [profilerArgs, ...additionalArgs];
    logger.info(`Command: ${launch.executable} ${processArgs.join(' ')}`);

    const process = await spawnProgramForTool(launch.executable, processArgs, {
      pathEntries: launch.pathEntries,
      cwd: launch.cwd,
      env: { ...launch.environment },
      sanitizeVsCodeEnv: true
    });
    if (process.killed || process.pid === undefined) {
      throw new Error('Process failed to start');
    }

    logger.info(`Qt Bridge profiler process PID: ${String(process.pid)}`);
    profilerLaunch = launch;
    setupProcessForProfiler(
      process,
      manager,
      host,
      port,
      metadata.application.assemblyName,
      folder
    );
    return true;
  } catch (err) {
    logger.error(`Failed to start Qt Bridge QML Profiler: ${String(err)}`);
    manager.dispose();
    launch?.dispose();
    ui.showFailedToStart(err instanceof Error ? err : new Error(String(err)));
    return false;
  }
}

// ─────────────────────────── attach ──────────────────────────────────────────

function attachProfiler(host: string, port: number) {
  logger.info(`Attaching QML Profiler to ${host}:${String(port)}`);

  const manager = createProfilerManager();
  const traceName = `qml_profiler`;
  const folder = vscode.workspace.workspaceFolders?.[0];

  manager.onConnectionOpened(() => {
    logger.info('QML Profiler connection opened (attach mode)');
    ui.showAttachSuccess(host, port);
    manager.startRecording();
    ui.setProfilerRecording();
  });

  manager.onConnectionFailed(() => {
    logger.info('QML Profiler connection failed (attach mode)');
    ui.showFailedToAttach(new Error('Connection failed'));
    cleanupSession();
  });

  manager.onConnectionClosed(() => {
    logger.info('QML Profiler connection closed (attach mode)');
    cleanupSession();
  });

  manager.onRecordingCompleted(() => {
    void onRecordingCompleted(manager, traceName, folder);
  });

  manager.onServiceUnavailable(() => {
    cleanupSession();
  });

  try {
    profilerManager = manager;
    manager.connectToServer({ host, port, scheme: ServerScheme.Tcp });
    return true;
  } catch (err) {
    logger.error(`Failed to attach: ${String(err)}`);
    manager.dispose();
    profilerManager = undefined;
    return false;
  }
}

// ─────────────────────────── start impl ──────────────────────────────────────

async function startQmlProfilerImpl() {
  const folder = await resolveWorkspaceFolder(false);
  if (!folder) {
    void vscode.window.showWarningMessage(
      'No workspace folder available for QML Profiler.'
    );
    return;
  }

  const activeUri = vscode.window.activeTextEditor?.document.uri;
  let bridgeProject: QtBridgeProject | undefined;
  let projectType = getProjectType(folder);
  if (!projectType) {
    const bridgeProjects = getQtBridgePreviewProjects(
      getQtBridgeProjects(folder)
    );
    bridgeProject = await selectQtBridgePreviewProject(
      folder,
      activeUri,
      undefined,
      'QML Profiler - select Qt Bridge project'
    );
    if (bridgeProjects.length > 1 && !bridgeProject) {
      logger.info('Qt Bridge project selection was cancelled');
      return;
    }
    projectType = getProjectType(folder, bridgeProject);
  }
  logger.info(`Project type for "${folder.name}": ${projectType ?? 'unknown'}`);

  if (projectType === 'pyside') {
    await launchPySideProfiler(folder);
  } else if (projectType === 'bridge') {
    if (!bridgeProject) {
      logger.error(
        `No Qt Bridge project found for folder: ${folder.uri.fsPath}`
      );
      return;
    }
    await launchQtBridgeProfiler(folder, bridgeProject);
  } else {
    await launchCMakeProfiler(folder);
  }
}

async function startQmlProfiler() {
  if (isProfilerStartingOrRunning()) {
    logger.info(
      'Ignoring QML Profiler start request: a session is already active'
    );
    ui.showAlreadyRunning();
    return;
  }

  const startPromise = startQmlProfilerImpl();
  profilerStartPromise = startPromise;
  try {
    await startPromise;
  } finally {
    if (profilerStartPromise === startPromise) {
      profilerStartPromise = undefined;
    }
  }
}

// ─────────────────────────── exported commands ────────────────────────────────

export function registerStartQmlProfilerCommand() {
  return vscode.commands.registerCommand(
    `${EXTENSION_ID}.startQmlProfiler`,
    async () => {
      logger.info('startQmlProfiler command invoked');
      telemetry.sendAction('startQmlProfiler');
      await startQmlProfiler();
    }
  );
}

export function registerAttachQmlProfilerCommand() {
  return vscode.commands.registerCommand(
    `${EXTENSION_ID}.attachQmlProfiler`,
    async () => {
      logger.info('attachQmlProfiler command invoked');
      telemetry.sendAction('attachQmlProfiler');

      if (isProfilerStartingOrRunning()) {
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
          profilerManager?.cancelConnection();
          cleanupSession();
        }
      );

      attachProfiler(connectionInfo.host, connectionInfo.port);
    }
  );
}

export function registerStopQmlProfilerCommand() {
  return vscode.commands.registerCommand(
    `${EXTENSION_ID}.stopQmlProfiler`,
    () => {
      telemetry.sendAction('stopQmlProfiler');

      if (!profilerManager) {
        ui.showNotRunning();
        return;
      }

      if (profilerManager.isRecording) {
        logger.info('Stopping recording');
        profilerManager.stopRecording();
        // onRecordingCompleted will save the trace and clean up
      } else {
        logger.info('Stopping profiler process');
        cleanupSession();
      }
    }
  );
}

export function disposeProfilerManager() {
  cleanupSession();
  ui.dispose();
}

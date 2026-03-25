// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import {
  CoreAPI,
  getCoreApi,
  createLogger,
  initLogger,
  telemetry,
  QtWorkspaceConfigMessage,
  QtWorkspaceFeatures,
  createColorProvider,
  CoreKey
} from 'qt-lib';
import { registerRestartQmllsCommand } from '@cmd/restart-qmlls.mjs';
import { registerDownloadQmllsCommand } from '@cmd/download-qmlls.mjs';
import { registerDebugPort } from '@cmd/debug.mjs';
import { registerCheckQmllsUpdateCommand } from '@cmd/check-qmlls-update.mjs';
import { getDoNotAskForDownloadingQmlls, Qmlls } from '@/qmlls.mjs';
import * as installer from '@/installer.mjs';
import * as consts from '@/constants.js';
import { QMLProjectManager, createQMLProject } from '@/project.mjs';
import { registerResetCommand } from '@cmd/reset.mjs';
import { registerQmlDebugAdapterFactory } from '@debug/debug-adapter.mjs';
import {
  registerStartQmlPreviewCommand,
  registerStartQmlPreviewForCurrentFileCommand,
  registerAttachQmlPreviewCommand,
  registerStopQmlPreviewCommand,
  registerReloadQmlPreviewCommand,
  registerClearQmlPreviewCacheCommand,
  disposePreviewManager
} from '@/preview/preview.mjs';
import {
  registerStartQmlProfilerCommand,
  registerAttachQmlProfilerCommand,
  registerStopQmlProfilerCommand,
  disposeProfilerManager
} from '@/profiler/profiler.mjs';
import {
  acquirePortTaskProvider,
  AcquirePortTaskProvider
} from './tasks/acquire-port.mjs';

export let projectManager: QMLProjectManager;
export let coreAPI: CoreAPI | undefined;

const taskProviders: vscode.Disposable[] = [];

const logger = createLogger('extension');

export async function activate(context: vscode.ExtensionContext) {
  initLogger(consts.EXTENSION_ID);
  telemetry.activate(context);

  installer.initialize(context.globalStorageUri);

  projectManager = new QMLProjectManager(context);
  coreAPI = await getCoreApi();
  if (!coreAPI) {
    const err = 'Failed to get CoreAPI';
    logger.error(err);
    throw new Error(err);
  }

  if (vscode.workspace.workspaceFolders !== undefined) {
    for (const folder of vscode.workspace.workspaceFolders) {
      const project = await createQMLProject(folder, context);
      projectManager.addProject(project);
    }
  }

  coreAPI.onValueChanged((message) => {
    logger.debug(
      'Received config change:',
      message.config as unknown as string
    );
    processMessage(message);
  });

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => {
      updatePreviewLaunchContext();
    }),
    registerDebugPort(),
    registerRestartQmllsCommand(),
    registerCheckQmllsUpdateCommand(),
    registerDownloadQmllsCommand(),
    vscode.languages.registerColorProvider('qml', createColorProvider()),
    registerResetCommand(),
    registerQmlDebugAdapterFactory(),
    registerStartQmlPreviewCommand(),
    registerStartQmlPreviewForCurrentFileCommand(),
    registerAttachQmlPreviewCommand(),
    registerStopQmlPreviewCommand(),
    registerReloadQmlPreviewCommand(),
    registerClearQmlPreviewCacheCommand(),
    registerStartQmlProfilerCommand(),
    registerAttachQmlProfilerCommand(),
    registerStopQmlProfilerCommand()
  );
  taskProviders.push(
    vscode.tasks.registerTaskProvider(
      AcquirePortTaskProvider.type,
      acquirePortTaskProvider
    )
  );
  telemetry.sendEvent(`activated`);
  projectManager.getConfigValues();
  projectManager.updateQmllsParams();
  startQmlls();
}

function startQmlls() {
  // Start qmlls immediately without waiting for the release check
  void projectManager.startQmlls();

  // Perform the release check asynchronously in the background
  const shouldCheck = !getDoNotAskForDownloadingQmlls();
  if (shouldCheck) {
    Qmlls.checkAssetAndDecide();
  }
}

export function deactivate() {
  logger.info(`Deactivating ${consts.EXTENSION_ID}`);
  telemetry.dispose();
  projectManager.dispose();
  disposePreviewManager();
  disposeProfilerManager();
  for (const provider of taskProviders) {
    provider.dispose();
  }
}

function updatePreviewLaunchContext() {
  const activeUri = vscode.window.activeTextEditor?.document.uri;
  const folder = activeUri
    ? vscode.workspace.getWorkspaceFolder(activeUri)
    : undefined;

  let launchEnabled = false;
  if (folder) {
    const features = coreAPI?.getValue<QtWorkspaceFeatures>(
      folder,
      CoreKey.WORKSPACE_FEATURES
    );
    // Enable preview launch for CMake and PySide projects.
    launchEnabled =
      features?.projectTypes.cmake === true ||
      features?.projectTypes.pyside === true;
  }
  logger.info(
    `Setting qmlPreviewLaunchEnabled to ${String(launchEnabled)} for folder "${String(folder?.name)}"`
  );
  void vscode.commands.executeCommand(
    'setContext',
    'qt-qml.qmlPreviewLaunchEnabled',
    launchEnabled
  );
}

function processMessage(message: QtWorkspaceConfigMessage) {
  try {
    // check if workspace folder is a string. If it is, it means the global
    // workspace
    if (typeof message.workspaceFolder === 'string') {
      return;
    }
    const project = projectManager.getProject(message.workspaceFolder);
    if (!project) {
      logger.error('Project not found');
      return;
    }
    let updateQmlls = false;
    for (const key of message.config.keys()) {
      if (key === CoreKey.SELECTED_QT_PATHS) {
        const selectedQtPaths = coreAPI?.getValue<string>(
          message.workspaceFolder,
          CoreKey.SELECTED_QT_PATHS
        );
        if (selectedQtPaths !== project.qtpathsExe) {
          updateQmlls = true;
          project.qtpathsExe = selectedQtPaths;
        }
        continue;
      }
      if (key === CoreKey.BUILD_DIR) {
        const buildDir = coreAPI?.getValue<string>(
          message.workspaceFolder,
          CoreKey.BUILD_DIR
        );
        if (buildDir !== project.buildDir) {
          updateQmlls = true;
          project.buildDir = buildDir;
        }
      }
      if (key === CoreKey.WORKSPACE_FEATURES) {
        logger.info(
          'Updating workspace features for project',
          project.folder.name
        );
        const features = coreAPI?.getValue<QtWorkspaceFeatures>(
          message.workspaceFolder,
          CoreKey.WORKSPACE_FEATURES
        );
        if (features?.projectTypes.pyside === true) {
          void project.initPySideProject();
        }
        updatePreviewLaunchContext();
      }
    }
    if (updateQmlls) {
      project.updateQmllsParams();
      void project.restartQmlls();
    }
  } catch (e) {
    const err = e as Error;
    logger.error(err.message);
    void vscode.window.showErrorMessage(`Error: "${err.message}"`);
  }
}

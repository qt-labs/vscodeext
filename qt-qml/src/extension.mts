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
  acquirePortTaskProvider,
  AcquirePortTaskProvider
} from './tasks/acquire-port.mjs';

export let projectManager: QMLProjectManager;
export let coreAPI: CoreAPI | undefined;

let taskProvider: vscode.Disposable | undefined;

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
    registerDebugPort(),
    registerRestartQmllsCommand(),
    registerCheckQmllsUpdateCommand(),
    registerDownloadQmllsCommand(),
    vscode.languages.registerColorProvider('qml', createColorProvider()),
    registerResetCommand(),
    registerQmlDebugAdapterFactory()
  );
  taskProvider = vscode.tasks.registerTaskProvider(
    AcquirePortTaskProvider.type,
    acquirePortTaskProvider
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
  if (taskProvider) {
    taskProvider.dispose();
  }
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

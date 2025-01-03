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
  waitForQtCpp,
  createColorProvider
} from 'qt-lib';
import { registerRestartQmllsCommand } from '@cmd/restart-qmlls';
import { registerDownloadQmllsCommand } from '@cmd/download-qmlls';
import { registerCheckQmllsUpdateCommand } from '@cmd/check-qmlls-update';
import { getDoNotAskForDownloadingQmlls, Qmlls, QmllsStatus } from '@/qmlls';
import { EXTENSION_ID } from '@/constants';
import { QMLProjectManager, createQMLProject } from '@/project';
import { registerResetCommand } from '@cmd/reset';

export let projectManager: QMLProjectManager;
export let coreAPI: CoreAPI | undefined;

const logger = createLogger('extension');

export async function activate(context: vscode.ExtensionContext) {
  initLogger(EXTENSION_ID);
  telemetry.activate(context);
  projectManager = new QMLProjectManager(context);
  coreAPI = await getCoreApi();
  if (!coreAPI) {
    const err = 'Failed to get CoreAPI';
    logger.error(err);
    throw new Error(err);
  }

  await waitForDependencies();

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
    registerRestartQmllsCommand(),
    registerCheckQmllsUpdateCommand(),
    registerDownloadQmllsCommand(),
    vscode.languages.registerColorProvider('qml', createColorProvider()),
    registerResetCommand()
  );
  telemetry.sendEvent(`activated`);
  projectManager.getConfigValues();
  projectManager.updateQmllsParams();
  void startQmlls();
}

async function startQmlls() {
  const shouldCheck = !getDoNotAskForDownloadingQmlls();
  let result: QmllsStatus | undefined;
  if (shouldCheck) {
    result = await Qmlls.checkAssetAndDecide();
  }
  if (!shouldCheck || result === QmllsStatus.stopped) {
    void projectManager.startQmlls();
  }
}

export function deactivate() {
  logger.info(`Deactivating ${EXTENSION_ID}`);
  telemetry.dispose();
  projectManager.dispose();
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
      if (key === 'selectedKitPath') {
        const selectedKitPath = coreAPI?.getValue<string>(
          message.workspaceFolder,
          'selectedKitPath'
        );
        if (selectedKitPath !== project.kitPath) {
          updateQmlls = true;
          project.kitPath = selectedKitPath;
        }
        continue;
      }
      if (key === 'selectedQtPaths') {
        const selectedQtPaths = coreAPI?.getValue<string>(
          message.workspaceFolder,
          'selectedQtPaths'
        );
        if (selectedQtPaths !== project.qtpathsExe) {
          updateQmlls = true;
          project.qtpathsExe = selectedQtPaths;
        }
        continue;
      }
      if (key === 'buildDir') {
        const buildDir = coreAPI?.getValue<string>(
          message.workspaceFolder,
          'buildDir'
        );
        if (buildDir !== project.buildDir) {
          updateQmlls = true;
          project.buildDir = buildDir;
        }
      }
    }
    if (updateQmlls) {
      project.updateQmllsParams();
      void project.qmlls.restart();
    }
  } catch (e) {
    const err = e as Error;
    logger.error(err.message);
    void vscode.window.showErrorMessage(`Error: "${err.message}"`);
  }
}

async function waitForDependencies() {
  return waitForQtCpp();
}

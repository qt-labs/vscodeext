// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import {
  PythonExtension as PyApi,
  ActiveEnvironmentPathChangeEvent as PyApiEnvChanged
} from '@vscode/python-extension';

import { CoreAPI, getCoreApi, createLogger, initLogger } from 'qt-lib';
import { PySideTaskProvider } from './task';
import { PySideDebugConfigProvider } from './debug';
import { PySideProjectManager } from './project-manager';
import * as consts from '@/constants';

const logger = createLogger('extension');

export let pyApi: PyApi | undefined;
export let projectManager: PySideProjectManager;
export let coreApi: CoreAPI | undefined;

export async function activate(context: vscode.ExtensionContext) {
  initLogger(consts.LOG_NAME);
  logger.info(`Activate: ${consts.EXTENSION_ID}`);

  try {
    await initDependency();
    await initCoreApi();
    await initPythonSupport(context);
    logger.info(`Activated: ${consts.EXTENSION_ID}`);
  } catch (e) {
    logger.error(`Cannot activate: ${consts.EXTENSION_ID}: ${String(e)}`);
  }
}

export function deactivate() {
  logger.info(`Deactivate: ${consts.EXTENSION_ID}`);
}

// helpers
async function initDependency() {
  await vscode.extensions.getExtension(consts.MS_PYTHON_ID)?.activate();
}

async function initCoreApi() {
  coreApi = await getCoreApi();
  if (!coreApi) {
    throw new Error('Cannot get CoreAPI');
  }
}

async function initPythonSupport(context: vscode.ExtensionContext) {
  pyApi = await PyApi.api();
  projectManager = new PySideProjectManager(context);
  await projectManager.init();

  const task = new PySideTaskProvider();
  const debug = new PySideDebugConfigProvider();

  context.subscriptions.push(
    projectManager,
    pyApi.environments.onDidChangeActiveEnvironmentPath(onPyApiEnvChanged),
    vscode.tasks.registerTaskProvider(consts.TASK.TYPE, task),
    vscode.debug.registerDebugConfigurationProvider(consts.DEBUG.TYPE, debug)
  );
}

const onPyApiEnvChanged = async (e: PyApiEnvChanged) => {
  logger.info(`Active environment changed: ${e.resource?.uri.fsPath}`);

  const folder = e.resource;
  const project = folder && projectManager.getProject(folder);
  if (project) {
    await project.refreshEnv(pyApi);
  }
};

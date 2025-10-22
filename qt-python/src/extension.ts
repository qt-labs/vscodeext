// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import {
  PythonExtension as PyApi,
  ActiveEnvironmentPathChangeEvent as PyApiEnvChanged
} from '@vscode/python-extension';

import {
  CoreAPI,
  getCoreApi,
  createLogger,
  initLogger,
  telemetry
} from 'qt-lib';
import { PySideTaskProvider } from './task';
import { PySideDebugConfigProvider } from './debug';
import { PySideProjectManager } from './project-manager';
import * as consts from '@/constants';
import { onInstallPySide6Command } from './installer';

const logger = createLogger('extension');

export let pyApi: PyApi | undefined;
export let projectManager: PySideProjectManager;
export let coreApi: CoreAPI | undefined;

export async function activate(context: vscode.ExtensionContext) {
  initLogger(consts.LOG_NAME);
  logger.info(`Activate: ${consts.EXTENSION_ID}`);
  telemetry.activate(context);

  try {
    await initDependency();
    await initCoreApi();
    await initPythonSupport(context);
    initCommands(context);

    logger.info(`Activated: ${consts.EXTENSION_ID}`);
    telemetry.sendEvent('activated');
  } catch (e) {
    logger.error(`Cannot activate: ${consts.EXTENSION_ID}: ${String(e)}`);
  }
}

export function deactivate() {
  logger.info(`Deactivate: ${consts.EXTENSION_ID}`);
  telemetry.dispose();
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
    vscode.tasks.registerTaskProvider(consts.TASK_TYPE, task),
    vscode.debug.registerDebugConfigurationProvider(consts.DEBUG_TYPE, debug)
  );
}

function initCommands(context: vscode.ExtensionContext) {
  function register(c: string, callback: (...args: unknown[]) => unknown) {
    return vscode.commands.registerCommand(
      `${consts.COMMAND_PREFIX}.${c}`,
      async () => {
        telemetry.sendAction(c);
        await callback();
      }
    );
  }

  context.subscriptions.push(
    register(consts.COMMAND_INSTALL_PYSIDE, onInstallPySide6Command)
  );
}

const onPyApiEnvChanged = async (e: PyApiEnvChanged) => {
  const folder = e.resource;
  if (folder) {
    logger.info(`Active environment changed: ${folder.uri.fsPath}`);
    await projectManager.refreshEnv(folder);
  }
};

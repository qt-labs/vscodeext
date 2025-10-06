// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import {
  CoreAPI,
  getCoreApi,
  createLogger,
  initLogger,
  telemetry
} from 'qt-lib';
import { EXTENSION_ID } from '@/constants';
import { openWidgetDesigner, lastSpawnedDesignerRef } from '@/commands';
import { UIProjectManager } from '@/project-manager';
import { UIEditorProvider } from '@/editors/ui/ui-editor';

const logger = createLogger('extension');

export let coreAPI: CoreAPI | undefined;
export let projectManager: UIProjectManager;

export async function activate(context: vscode.ExtensionContext) {
  initLogger(EXTENSION_ID);
  logger.info(`Activating ${context.extension.id}`);
  telemetry.activate(context);

  await initCoreApi();
  await initProjectManager(context);

  context.subscriptions.push(
    UIEditorProvider.register(context),
    vscode.commands.registerCommand(
      `${EXTENSION_ID}.openWidgetDesigner`,
      openWidgetDesigner
    )
  );

  telemetry.sendEvent('activated');
  if (process.env.QT_TESTING === '1') {
    return { lastSpawnedDesignerRef };
  }
  return {};
}

export function deactivate() {
  logger.info(`Deactivating ${EXTENSION_ID}`);
  telemetry.dispose();
  projectManager.dispose();
}

async function initCoreApi() {
  coreAPI = await getCoreApi();
  if (!coreAPI) {
    const msg = 'Failed to get CoreAPI';
    logger.error(msg);
    throw new Error(msg);
  }
}

async function initProjectManager(context: vscode.ExtensionContext) {
  projectManager = new UIProjectManager(context);
  await projectManager.init();
}

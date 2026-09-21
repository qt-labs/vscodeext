// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs';
import * as vscode from 'vscode';
import { isEmpty } from 'lodash';

import {
  createLogger,
  CoreKey,
  initLogger,
  telemetry,
  createColorProvider
} from 'qt-lib';
import { CoreAPIImpl } from '@/api';
import { registerQtDocsHoverProvider } from '@/docs/hover-provider';
import { registerQtDocsCommands } from '@/docs/online-docs';
import { registerSetRecommendedSettingsCommand } from '@/recommended-settings';
import {
  checkDefaultQtInsRootPath,
  getCurrentGlobalAdditionalQtPaths,
  getCurrentGlobalQtInstallationRoot,
  registerRegisterQtByPathCommand,
  registerRegisterQtCommand
} from '@/installation-root';
import { EXTENSION_ID } from '@/constants';
import { createCoreProject, CoreProjectManager } from '@/project';
import {
  registerOpenSettingsCommand,
  reportIssueCommand,
  resetCommand,
  registerShowLogCommand
} from '@/small-commands';
import {
  checkQtpathsInEnvPath,
  registerQtByQtpaths,
  warnAboutMissingQtPath
} from '@/qtpaths';
import { checkVcpkg } from '@/vcpkg';

import { addNewItem } from '@/webview/new-item/controller';
import { addExBrowser } from '@/webview/ex-browser/controller';
import { addWelcomePage, showEntryPage } from '@/webview/welcome/controller';
import { addCoursesBrowser } from '@/webview/courses/controller';
import { addQtTsSupport } from '@/translation';
import { addUiFileSupport } from '@/ui-file/editor-provider';
import { addQrcFileSupport } from '@/webview/qrc-editor/editor-provider';
import { addQmlTraceFileSupport } from '@/webview/qml-trace/editor-provider';

const logger = createLogger('extension');

export let coreAPI: CoreAPIImpl | undefined;
export let projectManager: CoreProjectManager;

export async function activate(context: vscode.ExtensionContext) {
  initLogger(EXTENSION_ID);
  telemetry.activate(context);
  logger.info(`Activating ${context.extension.id}`);
  projectManager = new CoreProjectManager(context);
  if (vscode.workspace.workspaceFile !== undefined) {
    projectManager.addWorkspaceFile(vscode.workspace.workspaceFile);
  }
  if (vscode.workspace.workspaceFolders !== undefined) {
    for (const folder of vscode.workspace.workspaceFolders) {
      const project = await createCoreProject(folder, context);
      projectManager.addProject(project);
    }
  }

  context.subscriptions.push(
    registerSetRecommendedSettingsCommand(),
    resetCommand(),
    registerQtByQtpaths(),
    registerOpenSettingsCommand(),
    registerRegisterQtCommand(),
    registerRegisterQtByPathCommand(),
    reportIssueCommand(),
    registerShowLogCommand()
  );

  registerQtDocsCommands(context);
  registerQtDocsHoverProvider(context);
  registerWebApps(context);
  registerQtFilesSupport(context);

  telemetry.sendEvent(`activated`);

  coreAPI = new CoreAPIImpl();

  checkDefaultQtInsRootPath();
  checkVcpkg();
  checkQtpathsInEnvPath();
  initCoreValues();

  void showEntryPage(context);

  return coreAPI;
}

export function deactivate() {
  logger.info(`Deactivating ${EXTENSION_ID}`);
  telemetry.dispose();
  projectManager.dispose();
}

export function initCoreValues() {
  const currentGlobalQtInstallationRoot = getCurrentGlobalQtInstallationRoot();
  coreAPI?.setValue(
    CoreKey.GLOBAL_WORKSPACE,
    CoreKey.QT_INSTALLATION_ROOT,
    currentGlobalQtInstallationRoot
  );
  if (currentGlobalQtInstallationRoot) {
    telemetry.sendEvent('qtInstallationRootUsedGlobal');
  }
  const currentAdditionalQtPaths = getCurrentGlobalAdditionalQtPaths();
  coreAPI?.setValue(
    CoreKey.GLOBAL_WORKSPACE,
    CoreKey.ADDITIONAL_QT_PATHS,
    currentAdditionalQtPaths
  );
  if (!isEmpty(currentAdditionalQtPaths)) {
    telemetry.sendEvent('additionalQtPathsUsedGlobal');
  }
  for (const p of currentAdditionalQtPaths) {
    if (!fs.existsSync(p.path)) {
      warnAboutMissingQtPath(p);
    }
  }

  for (const project of projectManager.getProjects()) {
    project.initConfigValues();
  }
}

function registerWebApps(context: vscode.ExtensionContext) {
  addNewItem(context);
  addExBrowser(context);
  addWelcomePage(context);
  addCoursesBrowser(context);
}

function registerQtFilesSupport(context: vscode.ExtensionContext) {
  addQtTsSupport(context);
  addUiFileSupport(context);
  addQrcFileSupport(context);
  addQmlTraceFileSupport(context);

  context.subscriptions.push(
    vscode.languages.registerColorProvider('qss', createColorProvider())
  );
}

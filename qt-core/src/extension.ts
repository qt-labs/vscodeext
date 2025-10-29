// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

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
import { registerDocumentationCommands } from '@/online-docs';
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
  resetCommand
} from '@/small-commands';
import { checkQtpathsInEnvPath, registerQtByQtpaths } from '@/qtpaths';
import { checkVcpkg } from '@/vcpkg';
import { registerCreateNewItemPanelCommand } from '@/webview/new-item/panel';
import { registerQrcEditorProvider } from '@/webview/qrc-editor/editor-provider';
import { registerOpenInLinguistCommand } from '@/translation';

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
    ...registerDocumentationCommands(),
    registerSetRecommendedSettingsCommand(),
    resetCommand(),
    registerQtByQtpaths(),
    registerOpenSettingsCommand(),
    registerRegisterQtCommand(),
    registerRegisterQtByPathCommand(),
    registerOpenInLinguistCommand(),
    registerCreateNewItemPanelCommand(context),
    vscode.languages.registerColorProvider('qss', createColorProvider()),
    reportIssueCommand()
  );

  registerQrcEditorProvider(context);
  await enableQtTsFileSupport(context);

  telemetry.sendEvent(`activated`);

  coreAPI = new CoreAPIImpl();

  checkDefaultQtInsRootPath();
  checkVcpkg();
  checkQtpathsInEnvPath();
  initCoreValues();
  return coreAPI;
}

export function deactivate() {
  logger.info(`Deactivating ${EXTENSION_ID}`);
  telemetry.dispose();
  projectManager.dispose();
}

export function initCoreValues() {
  coreAPI?.setValue(
    CoreKey.GLOBAL_WORKSPACE,
    CoreKey.QT_INSTALLATION_ROOT,
    getCurrentGlobalQtInstallationRoot()
  );
  const currentAdditionalQtPaths = getCurrentGlobalAdditionalQtPaths();
  coreAPI?.setValue(
    CoreKey.GLOBAL_WORKSPACE,
    CoreKey.ADDITIONAL_QT_PATHS,
    currentAdditionalQtPaths
  );
  if (!isEmpty(currentAdditionalQtPaths)) {
    telemetry.sendEvent('additionalQtPathsUsedGlobal');
  }

  for (const project of projectManager.getProjects()) {
    project.initConfigValues();
  }
}

async function enableQtTsFileSupport(context: vscode.ExtensionContext) {
  const checker = async (doc: vscode.TextDocument) => {
    // <?xml version="1.0" encoding="utf-8"?>
    // <!DOCTYPE TS>
    // <TS version="2.1" language="en_US">
    //   <context> ...
    //   </context>
    // </TS>

    const languageId = 'qt-ts'; // contributes > languages
    const maxLinesToCheck = 3;
    const rootTagOpening = '<TS ';

    if (!doc.fileName.endsWith('.ts') || doc.languageId === languageId) {
      return;
    }

    for (let i = 0; i < Math.min(maxLinesToCheck, doc.lineCount); i++) {
      if (doc.lineAt(i).text.startsWith(rootTagOpening)) {
        await vscode.languages.setTextDocumentLanguage(doc, languageId);
        break;
      }
    }
  };

  for (const doc of vscode.workspace.textDocuments) {
    await checker(doc);
  }

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(checker),
    vscode.workspace.onDidSaveTextDocument(checker)
  );
}

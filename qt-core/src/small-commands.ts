// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { coreAPI, projectManager } from '@/extension';
import { EXTENSION_ID, COMMAND_SHOW_LOG } from '@/constants';
import {
  getLogOutputChannel,
  getQtExtensionFullId,
  QtExtensions,
  telemetry
} from 'qt-lib';

export function resetCommand() {
  return vscode.commands.registerCommand(`${EXTENSION_ID}.reset`, () => {
    telemetry.sendAction('reset');
    coreAPI?.reset();
    projectManager.reset();
    QtExtensions.filter((extension) => extension.name !== EXTENSION_ID).forEach(
      (extension) => {
        void vscode.commands.executeCommand(`${extension.name}.reset`);
      }
    );
  });
}

export function registerOpenSettingsCommand() {
  return vscode.commands.registerCommand(`${EXTENSION_ID}.openSettings`, () => {
    telemetry.sendAction('openSettings');
    void vscode.commands.executeCommand(
      'workbench.action.openSettings',
      QtExtensions.map((e) => `@ext:${getQtExtensionFullId(e.name)}`).join(' ')
    );
  });
}

const issueReportLink =
  'https://qt-project.atlassian.net/secure/CreateIssue.jspa?pid=10233';

export function reportIssueCommand() {
  return vscode.commands.registerCommand(`${EXTENSION_ID}.reportIssue`, () => {
    void vscode.env.openExternal(vscode.Uri.parse(issueReportLink));
  });
}

export function registerShowLogCommand() {
  return vscode.commands.registerCommand(
    `${EXTENSION_ID}.${COMMAND_SHOW_LOG}`,
    () => {
      getLogOutputChannel()?.show();
    }
  );
}

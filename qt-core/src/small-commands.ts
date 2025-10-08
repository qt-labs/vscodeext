// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { coreAPI, projectManager } from '@/extension';
import { EXTENSION_ID } from '@/constants';
import { telemetry } from 'qt-lib';

export function resetCommand() {
  return vscode.commands.registerCommand(`${EXTENSION_ID}.reset`, () => {
    telemetry.sendAction('reset');
    coreAPI?.reset();
    projectManager.reset();
    const extensions = ['qt-cpp', 'qt-qml', 'qt-ui'];
    extensions.forEach((extension) => {
      void vscode.commands.executeCommand(`${extension}.reset`);
    });
  });
}

export function registerOpenSettingsCommand() {
  return vscode.commands.registerCommand(`${EXTENSION_ID}.openSettings`, () => {
    telemetry.sendAction('openSettings');
    void vscode.commands.executeCommand(
      'workbench.action.openSettings',
      `@ext:theqtcompany.qt-cpp @ext:theqtcompany.qt-qml @ext:theqtcompany.qt-ui @ext:theqtcompany.${EXTENSION_ID}`
    );
  });
}

const issueReportLink =
  'https://bugreports.qt.io/secure/CreateIssue.jspa?pid=13641';

export function reportIssueCommand() {
  return vscode.commands.registerCommand(`${EXTENSION_ID}.reportIssue`, () => {
    void vscode.env.openExternal(vscode.Uri.parse(issueReportLink));
  });
}

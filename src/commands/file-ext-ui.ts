// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as child_process from 'child_process';

import * as vscode from 'vscode';

import * as qtpath from '../util/get-qt-paths';
import * as local from '../util/localize';
import { getSelectedQtInstallationPath } from './register-qt-path';

export async function getQtDesignerPath() {
  const selectedQtPath = await getSelectedQtInstallationPath();
  if (selectedQtPath) {
    return qtpath.locateQtDesignerExePath(selectedQtPath);
  }
  return qtpath.DesignerExeName;
}

const OpenedUiDocuments = new Map<string, child_process.ChildProcess>();
async function openUiFileInQtDesigner(textEditor: vscode.TextEditor) {
  const document = textEditor.document;
  const uiFsPath = document.uri.fsPath || '';
  if (uiFsPath.endsWith('.ui')) {
    const promiseDesignerPath = getQtDesignerPath();
    const opened = OpenedUiDocuments.get(uiFsPath);
    if (!opened || opened.killed || opened.exitCode !== null) {
      const qtDesignerPath = await promiseDesignerPath;
      if (qtDesignerPath) {
        OpenedUiDocuments.set(
          uiFsPath,
          child_process.spawn(qtDesignerPath, [uiFsPath])
        );
      } else {
        local.warn('Qt Designer is not installed on your system');
      }
    }
  } else {
    local.warn('This command can only be used with .ui files');
  }
}

export function registerUiFile(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerTextEditorCommand(
      'vscode-qt-tools.openUiFileInQtDesigner',
      (textEditor: vscode.TextEditor) => {
        void openUiFileInQtDesigner(textEditor);
      }
    ),
    vscode.workspace.onDidCloseTextDocument((document) => {
      const uiFsPath = document.uri.fsPath || '';
      if (uiFsPath.endsWith('.ui')) {
        OpenedUiDocuments.delete(uiFsPath);
      }
    })
  );
}

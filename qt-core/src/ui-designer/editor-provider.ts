// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { telemetry } from 'qt-lib';
import { configWebviewPanel, basicWebviewAppConfig } from '@/webview/utils';
import * as consts from './constants';
import { UiFileEditorController } from './editor-controller';

type Context = vscode.ExtensionContext;
type WebviewPanel = vscode.WebviewPanel;

export function registerUiFileEditorProvider(context: Context) {
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      consts.CUSTOM_EDITOR_TYPE,
      new UiFileEditorProvider(context)
    )
  );
}

class UiFileEditorProvider implements vscode.CustomTextEditorProvider {
  private readonly _controllers = new Map<
    WebviewPanel,
    UiFileEditorController
  >();

  constructor(private readonly _context: Context) {}

  public async resolveCustomTextEditor(
    doc: vscode.TextDocument,
    panel: WebviewPanel,
    token: vscode.CancellationToken
  ): Promise<void> {
    void token;

    // view
    configWebviewPanel(panel, {
      appId: 'ui-designer',
      title: 'UI file',
      iconName: 'qt-ui',
      context: this._context,
      ...basicWebviewAppConfig
    });

    // doc
    await ensureDocumentNotEmpty(doc);

    // controller
    const controller = new UiFileEditorController(panel, doc.uri);
    this._controllers.set(panel, controller);

    panel.onDidDispose(() => {
      controller.dispose();
      this._controllers.delete(panel);
    });

    telemetry.sendEvent('UIFile:resolveCustomTextEditor');
    return Promise.resolve();
  }
}

// helpers
async function ensureDocumentNotEmpty(doc: vscode.TextDocument) {
  const noLines = doc.lineCount === 0;
  const oneLineButEmpty =
    doc.lineCount === 1 &&
    doc
      .getText()
      .replace(/^\uFEFF/, '')
      .trim().length === 0;

  if (!noLines && !oneLineButEmpty) {
    return undefined;
  }

  const edit = new vscode.WorkspaceEdit();
  const range = new vscode.Range(0, 0, doc.lineCount, 0);
  edit.replace(doc.uri, range, DefaultUiFileText);

  await vscode.workspace.applyEdit(edit);
  await doc.save();
}

const DefaultUiFileText = `
<?xml version="1.0" encoding="UTF-8"?>
<ui version="4.0">
  <class>Form</class>
  <widget class="QWidget" name="Form">
    <property name="geometry">
      <rect>
        <x>0</x>
        <y>0</y>
      <width>400</width>
      <height>300</height>
    </rect>
    </property>
    <property name="windowTitle">
      <string>Form</string>
    </property>
  </widget>
  <resources/>
  <connections/>
</ui>
`.trimStart();

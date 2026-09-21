// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import {
  window,
  commands,
  workspace,
  WebviewPanel as Panel,
  ExtensionContext as Context,
  Range,
  WorkspaceEdit,
  TextDocument as Doc,
  CancellationToken as Token,
  CustomTextEditorProvider as EditorProvider
} from 'vscode';

import { telemetry } from 'qt-lib';
import { setupWebApp } from '@/webview/utils';
import * as consts from './constants';
import { openInUiDesigner } from './commands';
import { UiFileController as Controller } from './controller';

export function addUiFileSupport(context: Context) {
  const openCmd = consts.COMMAND_OPEN_IN_WIDGETS_DESIGNER;
  const openCmdFull = `${consts.COMMAND_PREFIX}.${openCmd}`;

  context.subscriptions.push(
    window.registerCustomEditorProvider(
      consts.CUSTOM_EDITOR_TYPE,
      new UiFileEditorProvider(context)
    ),

    commands.registerCommand(openCmdFull, openInUiDesigner)
  );
}

class UiFileEditorProvider implements EditorProvider {
  private readonly _controllers = new Map<Panel, Controller>();

  constructor(private readonly _context: Context) {}

  public async resolveCustomTextEditor(doc: Doc, panel: Panel, token: Token) {
    void token;

    setupWebApp('ui-file', this._context, panel);

    await ensureDocumentNotEmpty(doc);
    const controller = new Controller(panel, doc.uri);
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
async function ensureDocumentNotEmpty(doc: Doc) {
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

  const edit = new WorkspaceEdit();
  const range = new Range(0, 0, doc.lineCount, 0);
  edit.replace(doc.uri, range, DefaultUiFileText);

  await workspace.applyEdit(edit);
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

// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import {
  window,
  workspace,
  TextDocument as Doc,
  WebviewPanel as Panel,
  ExtensionContext as Context,
  CancellationToken as Token,
  CustomTextEditorProvider as EditorProvider
} from 'vscode';

import { telemetry, DisposableStore } from 'qt-lib';
import { EXTENSION_ID } from '@/constants';
import { setupWebApp } from '@/webview/utils';
import { QrcDocsManager } from './docs-manager';
import { QrcEditorController as Controller } from './controller';

const editorType = `${EXTENSION_ID}.qrcEditor`;

export function addQrcFileSupport(context: Context) {
  const provider = new QrcEditorProvider(context);

  context.subscriptions.push(
    provider,
    window.registerCustomEditorProvider(editorType, provider)
  );

  // Set initial editor association based on the setting
  const configKey = 'enableQrcEditor';
  const configKeyFull = `${EXTENSION_ID}.${configKey}`;
  const config = workspace.getConfiguration(EXTENSION_ID);
  updateEditorAssociation(config.get<boolean>(configKey, true));

  // Listen for configuration changes
  const configListener = workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration(configKeyFull)) {
      const newConfig = workspace.getConfiguration(EXTENSION_ID);
      const newEnableQrcEditor = newConfig.get<boolean>(configKey, true);
      updateEditorAssociation(newEnableQrcEditor);
    }
  });

  context.subscriptions.push(configListener);
}

class QrcEditorProvider implements EditorProvider {
  private readonly _context: Context;
  private readonly _docsManager = new QrcDocsManager();
  private readonly _controllers = new Map<Panel, Controller>();
  private readonly _disposables = new DisposableStore();

  constructor(context: Context) {
    this._context = context;
    this._disposables.push(this._docsManager);
  }

  public dispose() {
    this._disposables.dispose();
  }

  public async resolveCustomTextEditor(doc: Doc, panel: Panel, token: Token) {
    void token;

    setupWebApp('qrc-editor', this._context, panel);

    this._docsManager.add(doc);
    const controller = new Controller(panel, this._docsManager, doc.uri.fsPath);
    this._controllers.set(panel, controller);

    panel.onDidDispose(() => {
      controller.dispose();
      this._controllers.delete(panel);
    });

    telemetry.sendEvent('QRCEditor:resolveCustomTextEditor');

    return Promise.resolve();
  }
}

function updateEditorAssociation(enable: boolean) {
  const section = 'workbench';
  const key = 'editorAssociations';

  const qrcAssociation = enable ? editorType : 'default';
  const allAssociations = workspace
    .getConfiguration(section)
    .get<Record<string, string>>(key, {});

  if (allAssociations['*.qrc'] !== qrcAssociation) {
    void workspace.getConfiguration(section).update(
      key,
      { ...allAssociations, '*.qrc': qrcAssociation },
      true // global configuration
    );
  }
}

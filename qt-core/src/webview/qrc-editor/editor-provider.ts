// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import {
  window,
  workspace,
  Disposable,
  WebviewPanel,
  TextDocument,
  ExtensionContext,
  CancellationToken,
  CustomTextEditorProvider
} from 'vscode';

import { telemetry } from 'qt-lib';
import { EXTENSION_ID } from '@/constants';
import { basicWebviewAppConfig, configWebviewPanel } from '@/webview/utils';
import { QrcDocsManager } from './docs-manager';
import { QrcEditorController } from './controller';

function updateEditorAssociation(enableQrcEditor: boolean) {
  const type = `${EXTENSION_ID}.qrcEditor`;
  const editorAssociations = workspace
    .getConfiguration('workbench')
    .get<Record<string, string>>('editorAssociations', {});
  const qrcAssociation = enableQrcEditor ? type : 'default';

  if (editorAssociations['*.qrc'] !== qrcAssociation) {
    void workspace.getConfiguration('workbench').update(
      'editorAssociations',
      { ...editorAssociations, '*.qrc': qrcAssociation },
      true // global configuration
    );
  }
}

export function registerQrcEditorProvider(context: ExtensionContext) {
  const type = `${EXTENSION_ID}.qrcEditor`;
  const provider = new QrcEditorProvider(context);
  const reg = window.registerCustomEditorProvider(type, provider);

  context.subscriptions.push(...[provider, reg]);

  // Set initial editor association based on the setting
  const config = workspace.getConfiguration(EXTENSION_ID);
  const enableQrcEditor = config.get<boolean>('enableQrcEditor', true);
  updateEditorAssociation(enableQrcEditor);

  // Listen for configuration changes
  const configListener = workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration(`${EXTENSION_ID}.enableQrcEditor`)) {
      const newConfig = workspace.getConfiguration(EXTENSION_ID);
      const newEnableQrcEditor = newConfig.get<boolean>(
        'enableQrcEditor',
        true
      );
      updateEditorAssociation(newEnableQrcEditor);
    }
  });

  context.subscriptions.push(configListener);
}

class QrcEditorProvider implements CustomTextEditorProvider {
  private readonly _context: ExtensionContext;
  private readonly _docsManager = new QrcDocsManager();
  private readonly _controllers = new Map<WebviewPanel, QrcEditorController>();
  private readonly _disposables: Disposable[] = [];

  constructor(context: ExtensionContext) {
    this._context = context;
    this._disposables.push(this._docsManager);
  }

  public dispose() {
    this._disposables.forEach((e) => {
      e.dispose();
    });
  }

  public async resolveCustomTextEditor(
    doc: TextDocument,
    panel: WebviewPanel,
    token: CancellationToken
  ): Promise<void> {
    void token;

    // view
    configWebviewPanel(panel, {
      appId: 'qrc-editor',
      title: 'QRC editor',
      context: this._context,
      ...basicWebviewAppConfig
    });

    // doc
    this._docsManager.add(doc);

    // controller
    const controller = new QrcEditorController(
      panel,
      this._docsManager,
      doc.uri.fsPath
    );

    this._controllers.set(panel, controller);
    panel.onDidDispose(() => {
      controller.dispose();
      this._controllers.delete(panel);
    });

    telemetry.sendEvent('QRCEditor:resolveCustomTextEditor');

    return Promise.resolve();
  }
}

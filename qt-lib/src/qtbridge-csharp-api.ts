// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import { resolveQtBridgeCSharpApi } from './qtbridge-csharp-api-internal';

const QT_BRIDGE_CSHARP_EXTENSION_ID = 'theqtcompany.qt-bridge-csharp';

export interface QtBridgeCSharpAPI {
  getProjects(): readonly QtBridgeProject[];
  getProject(folder: vscode.WorkspaceFolder): QtBridgeProject | undefined;
  getProjectForUri(uri: vscode.Uri): QtBridgeProject | undefined;
  readonly onDidChangeProjects: vscode.Event<void>;
}

export interface QtBridgeProject {
  readonly folder: vscode.WorkspaceFolder;
  readonly projectFile: vscode.Uri;
  readonly packageId: string | undefined;
  readonly packageVersion: string | undefined;
  readonly qtDir: vscode.Uri | undefined;
  readonly qmlImportRoot: vscode.Uri | undefined;

  refresh(): Promise<void>;
}

export async function getQtBridgeCSharpApi(): Promise<
  QtBridgeCSharpAPI | undefined
> {
  return resolveQtBridgeCSharpApi(
    vscode.extensions.getExtension(QT_BRIDGE_CSHARP_EXTENSION_ID)
  );
}

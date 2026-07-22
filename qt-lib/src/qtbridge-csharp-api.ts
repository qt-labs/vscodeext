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
  readonly onDidChangeMetadata: vscode.Event<QtBridgeMetadataChangeEvent>;
}

export interface QtBridgeProject {
  readonly folder: vscode.WorkspaceFolder;
  readonly projectFile: vscode.Uri;
  readonly packageId: string | undefined;
  readonly packageVersion: string | undefined;
  readonly qtDir: vscode.Uri | undefined;
  readonly qmlImportRoot: vscode.Uri | undefined;
  readonly metadata: QtBridgeQmlMetadata | undefined;
  readonly isMetadataReady: boolean;

  refresh(): Promise<void>;
}

export interface QtBridgeQmlMetadata {
  readonly metadataFile: string;
  readonly version: number;
  readonly projectFile: string;
  readonly configuration: string;
  readonly targetFramework: string | undefined;
  readonly application: QtBridgeApplicationMetadata | undefined;
  readonly qml: QtBridgeQmlProjectMetadata;
  readonly qmlLanguageServer: QtBridgeQmlLanguageServerMetadata | undefined;
}

export interface QtBridgeApplicationMetadata {
  readonly assemblyName: string;
  readonly executableName: string;
  readonly managedOutputDir: string;
  readonly managedHostPath: string;
  readonly nativeHostPath: string;
}

export interface QtBridgeQmlProjectMetadata {
  readonly sourceDir: string;
  readonly projectSourceDir: string;
  readonly buildDirs: readonly string[];
  readonly importPaths: readonly string[];
  readonly files: readonly QtBridgeQmlFile[];
}

export interface QtBridgeQmlFile {
  readonly sourcePath: string;
  readonly uri: string;
  readonly typeName: string;
  readonly modulePath: string;
}

export interface QtBridgeQmlLanguageServerMetadata {
  readonly disableCMakeCalls: boolean;
  readonly readyFile: string;
  readonly buildIni: string;
  readonly projectSourcesQrc: string | undefined;
}

export interface QtBridgeMetadataChangeEvent {
  readonly project: QtBridgeProject;
  readonly previous: QtBridgeQmlMetadata | undefined;
  readonly current: QtBridgeQmlMetadata | undefined;
  readonly reason: 'metadata' | 'ready-marker' | 'project';
}

export async function getQtBridgeCSharpApi(): Promise<
  QtBridgeCSharpAPI | undefined
> {
  return resolveQtBridgeCSharpApi(
    vscode.extensions.getExtension(QT_BRIDGE_CSHARP_EXTENSION_ID)
  );
}

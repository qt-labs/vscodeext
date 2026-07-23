// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import type { QtBridgeProject } from 'qt-lib';

export interface QtBridgeQmllsSessionConfig {
  readonly projectSourceDir: string;
  readonly buildDirs: readonly string[];
}

export interface QtBridgeQmllsAggregation {
  readonly importPaths: readonly string[];
  readonly sessionConfigs: readonly QtBridgeQmllsSessionConfig[];
  readonly startupBuildDir: string | undefined;
  readonly useNoCMakeCalls: boolean;
  readonly stateKey: string;
}

function appendUnique(values: string[], additions: readonly string[]) {
  for (const value of additions) {
    if (!values.includes(value)) {
      values.push(value);
    }
  }
}

export function aggregateQtBridgeQmllsProjects(
  projects: readonly QtBridgeProject[]
): QtBridgeQmllsAggregation {
  const importPaths: string[] = [];
  const sessionConfigs: QtBridgeQmllsSessionConfig[] = [];
  let useNoCMakeCalls = false;
  const sortedProjects = [...projects].sort((left, right) =>
    left.projectFile.fsPath.localeCompare(right.projectFile.fsPath)
  );

  for (const project of sortedProjects) {
    if (project.qmlImportRoot) {
      appendUnique(importPaths, [project.qmlImportRoot.fsPath]);
    }
    const metadata = project.metadata;
    const languageServer = metadata?.qmlLanguageServer;
    if (!project.isMetadataReady || !metadata || !languageServer) {
      continue;
    }
    appendUnique(importPaths, metadata.qml.importPaths);
    sessionConfigs.push({
      projectSourceDir: metadata.qml.projectSourceDir,
      buildDirs: [...metadata.qml.buildDirs]
    });
    useNoCMakeCalls ||= languageServer.disableCMakeCalls;
  }

  const startupBuildDir =
    sessionConfigs.length === 1 ? sessionConfigs[0]?.buildDirs[0] : undefined;
  const effectiveState = {
    importPaths,
    sessionConfigs,
    startupBuildDir,
    useNoCMakeCalls
  };
  return {
    ...effectiveState,
    stateKey: JSON.stringify(effectiveState)
  };
}

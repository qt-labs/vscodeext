// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

export enum TaskId {
  Run = 'run',
  Build = 'build',
  Clean = 'clean',
  Deploy = 'deploy'
}

export type ProjectToolAction = 'run' | 'build' | 'clean' | 'deploy';

export interface PySideProjectInfo {
  name: string;
  files: string[];
}

export interface PySidePackageInfo {
  version: string;
  location: string;
}

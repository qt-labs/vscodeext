// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

export enum TaskId {
  Run,
  Build,
  Clean,
  Deploy
}

export type ProjectToolAction = 'run' | 'build' | 'clean' | 'deploy';

export interface PySideProjectInfo {
  name: string;
  files: string[];
}

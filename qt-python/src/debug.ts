// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import * as vscode from 'vscode';

import { TaskId } from './types';
import { findTaskFullName } from './task';
import * as consts from './constants';

export class PySideDebugConfigProvider
  implements vscode.DebugConfigurationProvider
{
  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  resolveDebugConfiguration(
    folder: vscode.WorkspaceFolder | undefined,
    config: vscode.DebugConfiguration
  ) {
    config.type = consts.DEBUG.DELEGATE_TYPE;
    config.program ??= path.join(
      folder?.uri.fsPath ?? './',
      consts.DEBUG.DEFAULT_ENTRY_POINT
    );
    config.preLaunchTask ??= findTaskFullName(TaskId.Build);

    return config;
  }
}

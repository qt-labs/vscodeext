// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import { type QtBridgeCSharpAPI } from './qtbridge-csharp-api';

export async function resolveQtBridgeCSharpApi(
  extension: vscode.Extension<unknown> | undefined
): Promise<QtBridgeCSharpAPI | undefined> {
  if (!extension) {
    return undefined;
  }

  if (extension.isActive) {
    return extension.exports as QtBridgeCSharpAPI;
  }

  try {
    return (await extension.activate()) as QtBridgeCSharpAPI;
  } catch {
    return undefined;
  }
}

// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { getSelectedQtInstallationPath } from '@cmd/register-qt-path';
import { EXTENSION_ID } from '@/constants';

export function registerKitDirectoryCommand() {
  return vscode.commands.registerCommand(
    `${EXTENSION_ID}.kitDirectory`,
    async () => {
      return getSelectedQtInstallationPath();
    }
  );
}

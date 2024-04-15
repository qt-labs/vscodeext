// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as path from 'path';

import { getFilenameWithoutExtension } from '@util/util';

export function registerlaunchTargetFilenameWithoutExtension() {
  return vscode.commands.registerCommand(
    'qt.launchTargetFilenameWithoutExtension',
    async () => {
      const launchTargetFilename = await vscode.commands.executeCommand<string>(
        'cmake.launchTargetFilename'
      );
      if (!launchTargetFilename) {
        return '';
      }
      return getFilenameWithoutExtension(launchTargetFilename);
    }
  );
}

export function registerbuildDirectoryName() {
  return vscode.commands.registerCommand('qt.buildDirectoryName', async () => {
    const activeFolder = await vscode.commands.executeCommand<string>(
      'cmake.activeFolderPath'
    );
    const buildDirectory = await vscode.commands.executeCommand<string>(
      'cmake.buildDirectory',
      activeFolder
    );
    return path.basename(buildDirectory);
  });
}

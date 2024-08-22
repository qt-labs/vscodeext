// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as path from 'path';

import { getFilenameWithoutExtension } from '@util/util';
import { EXTENSION_ID } from '@/constants';

export function registerlaunchTargetFilenameWithoutExtension() {
  return vscode.commands.registerCommand(
    `${EXTENSION_ID}.launchTargetFilenameWithoutExtension`,
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
  return vscode.commands.registerCommand(
    `${EXTENSION_ID}.buildDirectoryName`,
    async () => {
      const activeFolder = await vscode.commands.executeCommand<string>(
        'cmake.activeFolderPath'
      );
      const buildDirectory = await vscode.commands.executeCommand<string>(
        'cmake.buildDirectory',
        activeFolder
      );
      return path.basename(buildDirectory);
    }
  );
}

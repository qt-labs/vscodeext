// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getSelectedQtInstallationPath } from './register-qt-path';

export function registerNatvisCommand() {
  const getNatvis = (version: string) => {
    const extension = vscode.extensions.getExtension('theqtcompany.qt');
    if (!extension) {
      throw new Error('Could not find the extension');
    }
    const extensionPath = extension.extensionPath;
    if (!extensionPath) {
      throw new Error('Could not find the extension path');
    }
    const natvisFile = path.join(
      extensionPath,
      'res',
      'natvis',
      `qt${version}.natvis.xml`
    );
    if (!fs.existsSync(natvisFile)) {
      throw new Error(`Could not find the natvis file: ${natvisFile}`);
    }
    return natvisFile;
  };

  const natvisDisposal = vscode.commands.registerCommand(
    'qt.natvis',
    async () => {
      const selectedQtInstallation = await getSelectedQtInstallationPath();
      if (!selectedQtInstallation) {
        throw new Error('Could not find the selected Qt installation path');
      }
      const qtVersion = selectedQtInstallation.includes('6.') ? '6' : '5';
      return getNatvis(qtVersion);
    }
  );
  const natvis5Disposal = vscode.commands.registerCommand('qt.natvis5', () => {
    return getNatvis('5');
  });
  const natvis6Disposal = vscode.commands.registerCommand('qt.natvis6', () => {
    return getNatvis('6');
  });

  return [natvisDisposal, natvis5Disposal, natvis6Disposal];
}

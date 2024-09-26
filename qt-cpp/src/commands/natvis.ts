// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

import { getSelectedQtInstallationPath } from '@cmd/register-qt-path';
import { createLogger } from 'qt-lib';
import { EXTENSION_ID } from '@/constants';

const logger = createLogger('natvis');

export function registerNatvisCommand() {
  const getNatvis = (version: string) => {
    const extension = vscode.extensions.getExtension(
      `theqtcompany.${EXTENSION_ID}`
    );
    if (!extension) {
      const error = 'Could not find the extension';
      logger.error(error);
      throw new Error(error);
    }
    const extensionPath = extension.extensionPath;
    if (!extensionPath) {
      const error = 'Could not find the extension path';
      logger.error(error);
      throw new Error(error);
    }
    const natvisFile = path.join(
      extensionPath,
      'res',
      'natvis',
      `qt${version}.natvis.xml`
    );
    if (!fs.existsSync(natvisFile)) {
      const error = `Could not find the natvis file: ${natvisFile}`;
      logger.error(error);
      throw new Error(error);
    }
    return natvisFile;
  };

  const natvisDisposal = vscode.commands.registerCommand(
    `${EXTENSION_ID}.natvis`,
    async () => {
      const selectedQtInstallation = await getSelectedQtInstallationPath();
      if (!selectedQtInstallation) {
        const error = 'Could not find the selected Qt installation path';
        logger.error(error);
        throw new Error(error);
      }
      const qtVersion = selectedQtInstallation.includes('6.') ? '6' : '5';
      return getNatvis(qtVersion);
    }
  );
  const natvis5Disposal = vscode.commands.registerCommand(
    `${EXTENSION_ID}.natvis5`,
    () => {
      return getNatvis('5');
    }
  );
  const natvis6Disposal = vscode.commands.registerCommand(
    `${EXTENSION_ID}.natvis6`,
    () => {
      return getNatvis('6');
    }
  );

  return [natvisDisposal, natvis5Disposal, natvis6Disposal];
}

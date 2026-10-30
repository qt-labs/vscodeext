// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

import { createLogger, telemetry } from 'qt-lib';
import { EXTENSION_ID } from '@/constants';
import { getActiveProject } from '@/project';

const logger = createLogger('natvis');

export function registerNatvisCommand() {
  const getNatvis = (version: string) => {
    const extension = vscode.extensions.getExtension(
      `theqtcompany.${EXTENSION_ID}`
    );
    if (!extension) {
      const error = 'Cannot find the extension';
      logger.error(error);
      throw new Error(error);
    }
    const extensionPath = extension.extensionPath;
    if (!extensionPath) {
      const error = 'Cannot find the extension path';
      logger.error(error);
      throw new Error(error);
    }
    const natvisSuffix = '.natvis';
    const natvisFile = path.join(
      extensionPath,
      'res',
      'natvis',
      `qt${version}${natvisSuffix}`
    );
    if (!fs.existsSync(natvisFile)) {
      const error = `Cannot find the natvis file: ${natvisFile}`;
      logger.error(error);
      throw new Error(error);
    }
    return natvisFile;
  };

  const natvisDisposal = vscode.commands.registerCommand(
    `${EXTENSION_ID}.natvis`,
    async () => {
      telemetry.sendAction('natvis');
      const project = await getActiveProject();
      if (!project) {
        logger.error('Cannot find an active project');
        return '';
      }
      // Ask for a kit if none is selected
      const majorVersion = await project.getMajorQtVersion(false);
      if (!majorVersion) {
        throw new Error('Cannot determine the major version');
      }
      return getNatvis(majorVersion);
    }
  );
  const natvis5Disposal = vscode.commands.registerCommand(
    `${EXTENSION_ID}.natvis5`,
    () => {
      telemetry.sendAction('natvis5');
      return getNatvis('5');
    }
  );
  const natvis6Disposal = vscode.commands.registerCommand(
    `${EXTENSION_ID}.natvis6`,
    () => {
      telemetry.sendAction('natvis6');
      return getNatvis('6');
    }
  );

  return [natvisDisposal, natvis5Disposal, natvis6Disposal];
}

// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as path from 'path';

import { createLogger, telemetry } from 'qt-lib';
import { getQtInsRoot, getSelectedKit } from '@cmd/register-qt-path';
import { EXTENSION_ID } from '@/constants';

const logger = createLogger('source-directory');

export function registerSourceDirectoryCommand() {
  return vscode.commands.registerCommand(
    `${EXTENSION_ID}.sourceDirectory`,
    async () => {
      telemetry.sendAction('sourceDirectory');
      const kit = await getSelectedKit();
      if (!kit) {
        return undefined;
      }
      const insRoot = getQtInsRoot(kit);
      if (!insRoot) {
        const config = vscode.workspace.getConfiguration(EXTENSION_ID);
        const doNotWarn = config.get<boolean>(
          'doNotWarnMissingSourceDir',
          false
        );
        const message = `Cannot find VSCODE_QT_INSTALLATION in the selected kit: ${kit.name}. Source directory cannot be determined.`;
        logger.error(message);
        if (!doNotWarn) {
          const doNotAskBtn = 'Do not show again';
          void vscode.window
            .showWarningMessage(message, doNotAskBtn)
            .then((result) => {
              if (result === doNotAskBtn) {
                void config.update(
                  'doNotWarnMissingSourceDir',
                  true,
                  vscode.ConfigurationTarget.Global
                );
              }
            });
        }
        return undefined;
      }
      // Remove the last part of the path to get the source directory
      // For example, if insRoot is '/path/to/Qt/6.5.0/gcc_64', we want to get '/path/to/Qt/6.5.0'
      const versionDir = path.dirname(insRoot);
      // Add the 'Src' directory to the path
      const sourceDir = path.join(versionDir, 'Src');
      logger.info(`Source directory for kit ${kit.name} is: ${sourceDir}`);
      return sourceDir;
    }
  );
}

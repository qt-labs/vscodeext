// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { cppSettings, createLogger, telemetry } from 'qt-lib';
import { EXTENSION_ID } from '@/constants';
import { getActiveProject } from '@/project';

const logger = createLogger('source-directory');

export function registerSourceDirectoryCommand() {
  return vscode.commands.registerCommand(
    `${EXTENSION_ID}.sourceDirectory`,
    async () => {
      telemetry.sendAction('sourceDirectory');
      const project = await getActiveProject();
      if (!project) {
        logger.warn(
          'No active C++ project found. Cannot determine source directory.'
        );
        return 'undefined';
      }
      const sourceDir = await project.getSourceDirectory();
      if (!sourceDir) {
        const message =
          'Source directory cannot be determined for the active project.';
        logger.error(message);
        if (!cppSettings.skipMissingSrcDirWarning.get(false)) {
          const doNotAskBtn = 'Do not show again';
          void vscode.window
            .showWarningMessage(message, doNotAskBtn)
            .then((result) => {
              if (result === doNotAskBtn) {
                void cppSettings.skipMissingSrcDirWarning.updateGlobal(true);
              }
            });
        }
        return 'undefined';
      }
      logger.info(`Source directory: ${sourceDir}`);
      return sourceDir;
    }
  );
}

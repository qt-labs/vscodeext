// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as path from 'path';

import { isMultiWorkspace, telemetry } from 'qt-lib';
import { EXTENSION_ID } from '@/constants';

interface RecommendedSetting {
  extensionId: string;
  setting: string;
  value: string;
}

export function registerSetRecommendedSettingsCommand() {
  const recommendedSettings: RecommendedSetting[] = [
    {
      extensionId: 'cmake',
      setting: 'options.statusBarVisibility',
      value: 'visible'
    },
    {
      extensionId: 'cmake',
      setting: 'buildDirectory',
      value: `\${workspaceFolder}${path.sep}builds${path.sep}\${buildKit}${path.sep}\${buildType}`
    }
  ];

  const configurationTarget = isMultiWorkspace()
    ? vscode.ConfigurationTarget.Workspace
    : undefined;
  const recommendedSettingsCommand = vscode.commands.registerCommand(
    `${EXTENSION_ID}.setRecommendedSettings`,
    () => {
      telemetry.sendAction('setRecommendedSettings');
      for (const { extensionId, setting, value } of recommendedSettings) {
        void vscode.workspace
          .getConfiguration(extensionId)
          .update(setting, value, configurationTarget);
      }
    }
  );
  return recommendedSettingsCommand;
}

// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { isMultiWorkspace } from '@/util/util';

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
    }
  ];

  const configurationTarget = isMultiWorkspace()
    ? vscode.ConfigurationTarget.Workspace
    : undefined;
  const recommendedSettingsCommand = vscode.commands.registerCommand(
    'qt-official.setRecommendedSettings',
    () => {
      for (const { extensionId, setting, value } of recommendedSettings) {
        void vscode.workspace
          .getConfiguration(extensionId)
          .update(setting, value, configurationTarget);
      }
    }
  );
  return recommendedSettingsCommand;
}

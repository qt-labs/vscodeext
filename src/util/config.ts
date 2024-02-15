import * as vscode from 'vscode';
// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

export function configChecker(config: string, func: CallableFunction) {
  return (e: vscode.ConfigurationChangeEvent) => {
    if (e.affectsConfiguration(config)) {
      func();
    }
  };
}

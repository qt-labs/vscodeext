// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

export function local(key: string): string {
  return vscode.l10n.t(key);
}

export function getCommandTitle(
  context: vscode.ExtensionContext,
  name: string
): string {
  const extension = context.extension;
  const packageJson = extension?.packageJSON as {
    contributes: { commands: vscode.Command[] };
  };
  const commands = packageJson?.contributes.commands;
  const command = commands?.find((c: vscode.Command) => c.command === name);
  if (command) {
    return command.title;
  }
  return '';
}

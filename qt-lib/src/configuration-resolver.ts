// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import untildify from 'untildify';

import { Home } from './util';

/**
 * Resolves configuration in a string, such as ${workspaceFolder}
 */
export function resolveConfiguration(input: string): string {
  let result = input;
  const configurationResolvers: Record<string, () => string | undefined> = {
    workspaceFolder: () =>
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? undefined,
    userHome: () => Home
  };

  // Resolve keys in configurationResolvers with values from the configurationResolvers object
  for (const key in configurationResolvers) {
    const callable = configurationResolvers[key];
    if (callable === undefined) {
      continue; // Skip if not a function
    }
    const val = callable();
    if (val === undefined) {
      continue; // Skip if the callable returns undefined
    }
    const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
    result = result.replace(regex, val);
  }

  // Resolve environment variables in the format ${env:VAR_NAME}
  result = result.replace(
    /\$\{env:([A-Za-z0-9_]+)\}/g,
    (_match, varName: string) => {
      return process.env[varName] ?? '';
    }
  );

  result = untildify(result);
  return result;
}

// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { QtAdditionalPath, inVCPKGRoot, resolveConfiguration } from 'qt-lib';
import { EXTENSION_ID } from '@/constants';

export function getConfiguration(scope?: vscode.ConfigurationScope) {
  return vscode.workspace.getConfiguration(EXTENSION_ID, scope);
}

export function convertAdditionalQtPaths(
  value: (string | object)[]
): QtAdditionalPath[] {
  return value.map((element) => {
    if (typeof element === 'string') {
      return {
        path: resolveConfiguration(element),
        isVCPKG: inVCPKGRoot(element)
      };
    }
    const ret = element as QtAdditionalPath;
    ret.isVCPKG = inVCPKGRoot(ret.path);
    ret.path = resolveConfiguration(ret.path);
    return ret;
  });
}

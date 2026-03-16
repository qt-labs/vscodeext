// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import * as vscode from 'vscode';

import { coreAPI } from '@/extension';
import { GlobalStateManager } from '@/state';
import { getNewProjectBaseDir, setDefaultProjectDir } from '@/qtcli/commands';
import {
  getCurrentGlobalAdditionalQtPaths,
  getCurrentGlobalQtInstallationRoot
} from '@/installation-root';
import {
  ExNewProjectArgs,
  ExPackagePoolDir,
  ExBrowserViewConfig
} from '@/webview/shared/ex-browser';
import { fsDir } from '@/fs-utils';
import * as consts from './constants';

type Context = vscode.ExtensionContext;

export function createViewConfig(context: Context): ExBrowserViewConfig {
  return {
    newProject: {
      name: 'untitled',
      workingDir: getNewProjectBaseDir(),
      saveProjectDir: false,
      openIn: new GlobalStateManager(context).getNewProjectOpenIn()
    }
  };
}

export function findAllPackagePools(): ExPackagePoolDir[] {
  const found: ExPackagePoolDir[] = [
    {
      sourceType: 'insRoot',
      fsPath: getCurrentGlobalQtInstallationRoot()
    }
  ];

  getCurrentGlobalAdditionalQtPaths().forEach((p) => {
    const info = coreAPI?.getQtInfoFromPath(p.path);
    if (info) {
      const docs = info.get('QT_INSTALL_DOCS'); // .../Qt/Docs/Qt-x.y.z
      const parent = docs ? path.dirname(path.dirname(docs)) : '';

      found.push({
        sourceType: 'qtpaths',
        fsPath: parent
      });
    }
  });

  return found.filter((loc) => {
    return (
      fsDir(loc.fsPath, consts.DOCS_DIR_NAME).exists() &&
      fsDir(loc.fsPath, consts.EX_DIR_NAME).exists()
    );
  });
}

export function createNewProject(
  args: ExNewProjectArgs,
  projectAbsDir: string,
  projectName: string
) {
  const name = args.name || projectName;
  const sourceDir = fsDir(projectAbsDir);
  const targetDir = fsDir(args.workingDir, name);

  sourceDir.copyAll(targetDir.toString());

  void targetDir.openAsWorkspace({
    newWindow: args.openIn === 'newWindow'
  });
}

export async function saveNewProjectArgs(args: ExNewProjectArgs, c: Context) {
  if (args.saveProjectDir) {
    await setDefaultProjectDir(args.workingDir);
  }

  await saveOpenInArg(args.openIn, c);
}

export async function saveOpenInArg(
  value: 'addToWorkspace' | 'newWindow',
  c: Context
) {
  const globalState = new GlobalStateManager(c);
  await globalState.setNewProjectOpenIn(value);
}

export function fallbackImageDir(c: Context) {
  return vscode.Uri.joinPath(c.extensionUri, 'res', 'icons');
}

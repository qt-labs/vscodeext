// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { Project } from 'qt-lib';

export async function createQMLProject(
  folder: vscode.WorkspaceFolder,
  context: vscode.ExtensionContext
) {
  return Promise.resolve(new QMLProject(folder, context));
}

// Project class represents a workspace folder in the extension.
export class QMLProject implements Project {
  public constructor(
    readonly _folder: vscode.WorkspaceFolder,
    readonly _context: vscode.ExtensionContext
  ) {}
  get folder() {
    return this._folder;
  }
  dispose() {
    void this;
  }
}

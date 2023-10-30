// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';

export class DefaultEnvironment {
  public constructor(readonly projectRoot: string) {
    this.teardown();
    const fakeShowErrorMessage = <T>(
      message: string,
      _options: vscode.MessageOptions,
      ..._items: T[]
    ): Thenable<T | undefined> => {
      void _options;
      void _items;
      throw new Error('fakeShowErrorMessage : ' + message);
    };
    this.sandbox
      .stub(vscode.window, 'showErrorMessage')
      .callsFake(fakeShowErrorMessage);
    const fakeShowInformationMessage = <T>(
      _message: string,
      _options: vscode.MessageOptions,
      ..._items: T[]
    ): Thenable<T | undefined> => {
      void _message;
      void _options;
      void _items;
      return Promise.resolve(undefined);
    };
    this.sandbox
      .stub(vscode.window, 'showInformationMessage')
      .callsFake(fakeShowInformationMessage);
  }
  readonly sandbox = sinon.createSandbox();
  readonly defaultCleanFolders = ['build', '.vscode', '.cache'];
  addtionalCleanFolders: string[] = [];
  public addCleanFolders(folders: string[]) {
    this.addtionalCleanFolders.push(...folders);
  }
  public teardown() {
    this.defaultCleanFolders.forEach((folder) => {
      const folderPath = path.join(this.projectRoot, folder);
      fs.rmSync(folderPath, { recursive: true, force: true });
    });
    this.addtionalCleanFolders.forEach((folder) => {
      const folderPath = path.join(this.projectRoot, folder);
      fs.rmSync(folderPath, { recursive: true, force: true });
    });
    this.sandbox.verifyAndRestore();
  }
  public getSandbox() {
    return this.sandbox;
  }
}

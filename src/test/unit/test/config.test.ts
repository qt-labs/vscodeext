// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as assert from 'assert';
import * as path from 'path';
// // You can import and use all API from the 'vscode' module
// // as well as import your extension to test it
import * as vscode from 'vscode';
import { DefaultEnvironment } from '../../helpers/default-environment';
import { getExtensionSourceRoot } from '../../util/util';
import { expect } from 'chai';

suite('Extension Test Suite', () => {
  let testEnv: DefaultEnvironment;
  const projectFolder = path.join(
    getExtensionSourceRoot(),
    'src',
    'test',
    'unit',
    'project-folder'
  );

  setup(function (this: Mocha.Context) {
    this.timeout(10000);
    testEnv = new DefaultEnvironment(projectFolder);
  });

  teardown(function (this: Mocha.Context) {
    testEnv.teardown();
  });
  suiteSetup(async function (this: Mocha.Context) {
    // open a workspace
    const extension = vscode.extensions.getExtension(
      'theqtcompany.qt-official'
    );
    assert.ok(extension);
    await extension.activate();
  });
  test('Set-JSON-files', async () => {
    // Note: sinon.stub cannot catch 'showInformationMessage' that's
    // why we count the call count of 'showInformationMessage' to check
    // if the function is called.
    // Normally the below function should have been used.
    // const fakeShowInformationMessage = <T>(
    //   _message: string,
    //   _options: vscode.MessageOptions,
    //   ..._items: T[]
    // ): Thenable<T | undefined> => {
    //   throw new Error('fakeShowInformationMessage : ' + _message);
    //   return Promise.resolve(undefined);
    // };
    testEnv.getSandbox().restore();
    const catchRegister = testEnv
      .getSandbox()
      .stub(vscode.window, 'showOpenDialog');
    catchRegister.callsFake((options) => {
      console.log('fakeShowOpenDialog');
      console.log('options: ', options);
      return Promise.resolve([vscode.Uri.file('')]);
    });
    const mystub = testEnv
      .getSandbox()
      .spy(vscode.window, 'showInformationMessage');
    expect(
      await vscode.commands.executeCommand('qt-official.registerQt')
    ).to.be.eq(0);
    expect(mystub.callCount).to.be.eq(1);
  }).timeout(10000);
});

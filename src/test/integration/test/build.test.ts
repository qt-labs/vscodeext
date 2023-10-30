// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { expect } from 'chai';
import * as vscode from 'vscode';
import {
  delay,
  getExtensionSourceRoot,
  activateIntegrationTestExtensions,
  getFirstQtInstallation,
  checkFolderExists,
  checkFileExists,
  getFirstQtKit
} from '../../util/util';
import { DefaultEnvironment } from '../../helpers/default-environment';
import * as path from 'path';
import { PlatformExecutableExtension } from '../../../util/get-qt-paths';

suite('Extension Test Suite', () => {
  let testEnv: DefaultEnvironment;
  const projectFolder = path.join(
    getExtensionSourceRoot(),
    'src',
    'test',
    'integration',
    'project-folder'
  );
  suiteSetup(async function (this: Mocha.Context) {
    await activateIntegrationTestExtensions();
    this.timeout(10000);
  });
  setup(function (this: Mocha.Context) {
    this.timeout(10000);

    testEnv = new DefaultEnvironment(projectFolder);
  });
  teardown(function (this: Mocha.Context) {
    testEnv.teardown();
  });
  test('Build', async () => {
    const qt_path = process.env['QT_PATH'];
    console.log('qt_path from test: ', qt_path);
    console.log('current path: ', process.cwd());
    const current_path = getExtensionSourceRoot();
    const projectFolder = path.join(
      current_path,
      'src',
      'test',
      'integration',
      'project-folder'
    );

    const mystub = testEnv.getSandbox().stub(vscode.window, 'showQuickPick');
    mystub.callsFake((items, options, _token) => {
      void _token;
      console.log('fakeShowQuickPick');
      console.log('options: ', options);
      console.log('items: ', items);
      const installation = getFirstQtInstallation(process.env['QT_PATH']);
      console.log('Found installation:', installation);

      if (typeof installation === 'undefined') {
        throw new Error('fakeShowQuickPick : no kit found');
      }
      return Promise.resolve({
        label: installation,
        description: installation
      } as vscode.QuickPickItem);
    });

    const catchRegister = testEnv
      .getSandbox()
      .stub(vscode.window, 'showOpenDialog');
    catchRegister.callsFake((options) => {
      console.log('fakeShowOpenDialog');
      console.log('options: ', options);
      return Promise.resolve([vscode.Uri.file(qt_path || '')]);
    });
    expect(
      await vscode.commands.executeCommand('vscode-qt-tools.registerQt')
    ).to.be.eq(0);
    // Note: tests are not stable due to the asyncronous nature of the extension
    // that's why wait until writing operations are done
    await delay(1000);
    await vscode.commands.executeCommand('cmake.scanForKits');
    await vscode.commands.executeCommand(
      'cmake.setKitByName',
      getFirstQtKit(process.env['QT_PATH'])
    );
    expect(await vscode.commands.executeCommand('cmake.configure')).to.be.eq(0);
    expect(await vscode.commands.executeCommand('cmake.build')).to.be.eq(0);
    const buildFolder = path.join(projectFolder, 'build');
    const expectedExe = path.join(
      buildFolder,
      'Debug',
      `example${PlatformExecutableExtension}`
    );
    expect(checkFolderExists(buildFolder)).to.be.true;
    expect(checkFileExists(expectedExe)).to.be.true;
  }).timeout(10000);
});

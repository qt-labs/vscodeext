// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { expect } from 'chai';
// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
const packageJson = require('../../../package.json');

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  suiteSetup(async function (this: Mocha.Context) {
    // activation of qt-cpp activates the extension depedencies (qt-core and cmake)
    // activation needed for vscode.commands.getCommands to see the extensions commands
    await vscode.extensions.getExtension('theqtcompany.qt-cpp')?.activate();
    this.timeout(10000);
  });

  test('Extension depedencies are active', async () => {
    if (packageJson.extensionDependencies) {
      for (const extensionId of packageJson.extensionDependencies) {
        expect(vscode.extensions.getExtension(extensionId)?.isActive).to.be.eq(
          true
        );
      }
    }
  });

  test('Qt-cpp commands are visible', async () => {
    const vscodeCommands = vscode.commands.getCommands(true);
    if (packageJson.contributes.commands) {
      // Listing qt-core commands
      for (const command of packageJson.contributes.commands) {
        let string_com: string = command.command;
        console.log(string_com);
        expect((await vscodeCommands).includes(string_com)).to.be.eq(true);
      }
    }
  });
});

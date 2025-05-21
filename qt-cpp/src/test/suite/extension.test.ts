// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { expect } from 'chai';
import * as sinon from 'sinon';
import {
  // getExtensionSourceRoot,
  delay
} from '../util/utils';
import { CoreAPI, getCoreApi } from 'qt-lib';
//import * as path from 'path';
//import { registerQt } from '../../../../qt-core/src/installation-root';
// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';

//const packageJson = require('../../../package.json');

//const packageJsonCore = require('../../../../qt-core/package.json');
//import { setDefaultPathButtonMessage } from '../../../../qt-core/src/installation-root';
import { MyClass } from '../../../src/commands/scan-qt-kits';
const testClass = new MyClass();

//import { DefaultEnvironment } from '../helpers/default-environment';

//import * as myExtension from '../../extension';

describe('Test suit', async () => {
  let sb: sinon.SinonSandbox;
  // let catchRegister: sinon.SinonStub;

  before('create a sand box', () => (sb = sinon.createSandbox()));
  // following does not help the stub reaching into other extension
  // before('create a stub before activating the extensions', () => {
  //   sb = sinon.createSandbox();
  //   catchRegister = sb.stub(vscode.window, 'showOpenDialog');
  //   catchRegister.callsFake((options) => {
  //     console.log('fakeShowOpenDialog');
  //     console.log('options: ', options);
  //     return Promise.resolve([vscode.Uri.file('')]);
  //   });
  // });
  before('activate', () =>
    vscode.extensions.getExtension('theqtcompany.qt-cpp')?.activate()
  );

  beforeEach('clearExtensionContext', () => (sb = sinon.createSandbox()));
  afterEach('clearExtensionContext', () => sb.verifyAndRestore());

  // To test the following the do not call activate before!!!!
  it('Testing stub reach in qt-core functions via activate', async () => {
    vscode.extensions.getExtension('theqtcompany.qt-cpp')?.activate();
    const fake_showInformationMessage = sb.stub(
      vscode.window,
      'showInformationMessage'
    );
    console.log(
      'fake_showInformationMessage called: ',
      fake_showInformationMessage.called
    );
    // The stub does not reach qt-core
    expect(fake_showInformationMessage.called).to.be.equals(false);
  });

  it('Testing stub reach in qt-cpp function dummyregisterQt', async () => {
    const catchRegister = sb.stub(vscode.window, 'showOpenDialog');
    catchRegister.callsFake((options) => {
      console.log('fakeShowOpenDialog');
      console.log('options: ', options);
      return Promise.resolve([vscode.Uri.file('')]);
    });

    await vscode.commands.executeCommand('qt-cpp.dummyregisterQt');
    delay(10000);
    // The stub is used when called from qt-cpp
    expect(catchRegister.called).to.be.true;
    expect(catchRegister.callCount).to.be.equals(1);
  });

  it('Testing stub reach in qt-core function registerQt', async () => {
    const catchRegister = sb.stub(vscode.window, 'showOpenDialog');
    catchRegister.callsFake((options) => {
      console.log('fakeShowOpenDialog');
      console.log('options: ', options);
      return Promise.resolve([vscode.Uri.file('')]);
    });

    await vscode.commands.executeCommand('qt-core.registerQt');
    delay(10000);
    // The stub is not used when called from qt-core
    expect(catchRegister.called).to.be.false;
    expect(catchRegister.callCount).to.be.equals(0);
  });

  it('Testing setting  qt installation root', async () => {
    let coreAPI: CoreAPI | undefined;
    coreAPI = await getCoreApi();

    console.log(
      'qtInstallation: ',
      vscode.workspace.getConfiguration('qt-core').get('qtInstallationRoot')
    );
    await vscode.commands.executeCommand('qt-core.registerQt');
    delay(20000);

    // await vscode.commands.executeCommand(
    //   'qt-core.registerQtByPath',
    //   '/Users/lucie/Qt'
    // );
    // (
    //   (await vscode.extensions
    //     .getExtension('theqtcompany.qt-core')
    //     ?.activate()) as CoreAPI
    // ).setMyStuff();
    // coreAPI?.setMyStuff();

    // CodeExpectedError: Unable to write to User Settings because qt-core.qtInstallation is not a registered configuration.
    // await vscode.workspace
    //   .getConfiguration('qt-core')
    //   .update(
    //     'qtInstallation',
    //     '/Users/lucie/Qt',
    //     vscode.ConfigurationTarget.Global
    //   );

    console.log(
      'qtInstallation: ',
      vscode.workspace.getConfiguration('qt-core').get('qtInstallationRoot')
    );

    console.log('coreAPI get QtInfo: ', coreAPI?.getQtInfo);

    // const catchRegister = sb.stub(vscode.window, 'showOpenDialog');
    // catchRegister.callsFake((options) => {
    //   console.log('fakeShowOpenDialog');
    //   console.log('options: ', options);
    //   return Promise.resolve([vscode.Uri.file('')]);
    // });

    // await vscode.commands.executeCommand('qt-core.registerQt');
    // delay(10000);
    // // The stub is not used when called from qt-core
    // expect(catchRegister.called).to.be.false;
    // expect(catchRegister.callCount).to.be.equals(0);
  });

  // it('Testing extension is active', async () => {
  //   if (packageJson.extensionDependencies) {
  //     for (const extensionId of packageJson.extensionDependencies) {
  //       expect(vscode.extensions.getExtension(extensionId)?.isActive).to.be.eq(
  //         true
  //       );
  //     }
  //   }
  // });

  // it('Testing extension commands are visible', async () => {
  //   const vscodeCommands = vscode.commands.getCommands(true);
  //   if (packageJson.contributes.commands) {
  //     // Listing qt-core commands
  //     for (const command of packageJson.contributes.commands) {
  //       let string_com: string = command.command;
  //       console.log(string_com);
  //       expect((await vscodeCommands).includes(string_com)).to.be.eq(true);
  //     }
  //   }
  // });

  // it('testing stub', async () => {
  //   const catchRegister = sb.stub(vscode.window, 'showOpenDialog');
  //   catchRegister.callsFake((options) => {
  //     console.log('fakeShowOpenDialog');
  //     console.log('options: ', options);
  //     return Promise.resolve([vscode.Uri.file('')]);
  //   });
  //   expect(await vscode.commands.executeCommand('qt-core.registerQt')).to.be.eq(
  //     0
  //   );
  // });

  it('testing stub 3', async () => {
    console.log(
      'value from function in class before stub: ',
      testClass.test_function(2, 3)
    );
    const testadd = sb.stub(testClass, 'add');
    //testadd.withArgs(10, 20).returns(100); //working
    //testadd.returns(100); //working
    testadd.callsFake((arg1, arg2) => {
      //working
      //console.log('fake add');
      console.log('arg1: ', arg1);
      console.log('arg2: ', arg2);
      return 100;
    });

    testClass.test_function(2, 3);
    testClass.test_function(2, 3);
    testClass.test_function(2, 3);
    testClass.test_function(2, 3);

    console.log(
      'value from function in class after stub: ',
      testClass.test_function(10, 20)
    );
    expect(testadd.callCount).to.be.equal(5);
  });
  expect(testClass.test_function(10, 20)).to.be.equal(100);
  expect(testClass.test_function(1, 2)).to.be.equal(100);
});

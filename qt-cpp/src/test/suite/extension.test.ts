import * as assert from 'assert';
import { expect } from 'chai';
// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// Ideally should not be hard coded but infered from the depedencies
// listed in qt-cpp package.json extensionDependencies
const corePackageJson = require('../../../../qt-core/package.json');

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('Sample test', () => {
    assert.strictEqual([1, 2, 3].indexOf(5), -1);
    assert.strictEqual([1, 2, 3].indexOf(0), -1);
  });

  suiteSetup(async function (this: Mocha.Context) {
    // by activating qt-cpp, the extension depedencies (qt-core and cmake) are activated
    // Needed for getCommands to see the extensions commands.
    await vscode.extensions.getExtension('theqtcompany.qt-cpp')?.activate();
    this.timeout(10000);
  });

  test('cmake extension test', async () => {
    // The folder is invalid and there is no active CMake project. cmake.configure returns -2
    expect(await vscode.commands.executeCommand('cmake.configure')).to.be.eq(
      -2
    );
    // Error: command 'cmake.configure' not found if the cmake extension is not installed
  });

  test('Qt core extension test commands are seen', async () => {
    const vscodeCommands = vscode.commands.getCommands(true);

    if (corePackageJson.contributes.commands) {
      // Listing qt-core commands
      for (const command of corePackageJson.contributes.commands) {
        let string_com: string = command.command;
        console.log(string_com);
        expect((await vscodeCommands).includes(string_com)).to.be.eq(true);
      }
    }
  });
});

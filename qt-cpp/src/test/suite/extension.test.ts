import * as assert from 'assert';
import { expect } from 'chai';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
//import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('Sample test', () => {
    assert.strictEqual([1, 2, 3].indexOf(5), -1);
    assert.strictEqual([1, 2, 3].indexOf(0), -1);
  });

  test('cmake extension test', async () => {
    // The folder is invalid and there is no active CMake project. cmake.configure returns -2
    expect(await vscode.commands.executeCommand('cmake.configure')).to.be.eq(
      -2
    );
    // Error: command 'cmake.configure' not found if the cmake extension is not installed
  });
});

// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { delay } from 'qt-lib';
import {
  setupSandboxLifecycleHooks,
  waitForVSCodeIdle,
  activateQtCpp,
  prepareCMakeQtEnvWithVersion,
  getWorkspaceFolderOrThrow,
  cleanBuildDir,
  setCMakeGeneratorForPlatform,
  prepareStandardCMakeArgs,
  readCMakeCacheVar,
  selectAndApplyKit
} from '../helper.mts';

describe('natvis: minimal Qt project debug (index-natvis)', function () {
  this.timeout(150_000);

  let sb: sinon.SinonSandbox;

  setupSandboxLifecycleHooks(
    (_sb) => (sb = _sb),
    async () => activateQtCpp()
  );

  it('configures, builds, and stops at a breakpoint', async function () {
    const wsFolder = getWorkspaceFolderOrThrow();
    const projectDir = wsFolder.uri.fsPath;
    console.log('Using projectDir:', projectDir);
    const buildDir = await cleanBuildDir(projectDir);

    await setCMakeGeneratorForPlatform(wsFolder);

    await selectAndApplyKit();

    // Qt: pin ONLY Qt6_DIR (no CMAKE_PREFIX_PATH)
    const qtRoot = vscode.workspace
      .getConfiguration('qt-core')
      .get<string>('qtInstallationRoot');
    if (typeof qtRoot !== 'string' || qtRoot.trim() === '') {
      throw new Error('qt-core.qtInstallationRoot is not configured.');
    }
    prepareCMakeQtEnvWithVersion({ topLevel: qtRoot, verbose: true });

    // Standard args
    prepareStandardCMakeArgs();

    // spy on error messages
    const errSpy = sb.spy(vscode.window, 'showErrorMessage');

    // ... run cmake.configure / cmake.build / assertions ...
    console.log('Running cmake.configure...');
    const rcCfg =
      await vscode.commands.executeCommand<number>('cmake.configure');
    await waitForVSCodeIdle();
    expect(rcCfg, `cmake.configure failed (rc=${rcCfg})`).to.equal(0);

    // confirm what CMake used
    if (process.env.QT_TEST_DEBUG === '1') {
      console.log('== WHAT CMAKE USED ==');
      console.log(
        '  Qt6_DIR =',
        readCMakeCacheVar(buildDir, 'Qt6_DIR') ?? '<unknown>'
      );
    }

    const rcBuild = await vscode.commands.executeCommand<number>('cmake.build');
    await waitForVSCodeIdle();
    expect(rcBuild, `cmake.build failed (rc=${rcBuild})`).to.equal(0);

    await delay(400); // flush to disk

    const bin = process.platform === 'win32' ? 'hello.exe' : 'hello';
    const outPath = path.join(buildDir, bin);
    console.log('Checking for binary at', outPath);

    expect(fs.existsSync(outPath), `Expected build artifact at ${outPath}`).to
      .be.true;
    expect(errSpy.called, 'Unexpected error popups during build').to.be.false;

    // Set breakpoints in source file ---
    const sourcePath = path.join(projectDir, 'main.cpp'); // adjust if filename differs
    const doc = await vscode.workspace.openTextDocument(sourcePath);
    await vscode.window.showTextDocument(doc);
    await waitForVSCodeIdle();

    const lines = doc.getText().split('\n');

    // Collect all marker lines
    const markerIdxs = lines
      .map((ln, i) => (ln.includes('BREAK_HERE') ? i : -1))
      .filter((i) => i >= 0);

    expect(
      markerIdxs.length,
      'No // BREAK_HERE markers found in source'
    ).to.be.greaterThan(0);
  });
});

// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import {
  delay,
  getCoreApi,
  CoreKey,
  findQtPathsInInstallationPath
} from 'qt-lib';
import {
  setupSandboxLifecycleHooks,
  waitForVSCodeIdle,
  activateQtCpp,
  prepareCMakeQtEnvWithVersion,
  getWorkspaceFolderOrThrow,
  cleanBuildDir,
  readCMakeCacheVar,
  setCMakeConfigurationForPlatform
} from '../helper.mts';

// Test timing constants
const FS_SETTLE_DELAY_MS = 500; // Wait for file system to settle after writing files
const DISK_FLUSH_DELAY_MS = 400; // Wait for build artifacts to flush to disk

describe('presets: CMake Presets integration', function () {
  this.timeout(150_000);

  let sb: sinon.SinonSandbox;

  setupSandboxLifecycleHooks(
    (_sb) => (sb = _sb),
    async () => activateQtCpp()
  );

  it('configures and builds a tiny Qt app with CMake Presets', async function () {
    const wsFolder = getWorkspaceFolderOrThrow();
    await setCMakeConfigurationForPlatform(
      wsFolder,
      'useCMakePresets',
      'always'
    );
    await waitForVSCodeIdle();
    const projectDir = wsFolder.uri.fsPath;
    const buildDir = await cleanBuildDir(projectDir, 'build-presets');
    const qtRoot = vscode.workspace
      .getConfiguration('qt-core')
      .get<string>('qtInstallationRoot');
    if (typeof qtRoot !== 'string' || qtRoot.trim() === '') {
      throw new Error('qt-core.qtInstallationRoot is not configured.');
    }
    const qtEnv = prepareCMakeQtEnvWithVersion({
      topLevel: qtRoot,
      verbose: true
    });
    const presetsPath = path.join(projectDir, 'CMakePresets.json');

    // Create a CMake Presets configuration
    // Note: generator is omitted because CMake will use the default generator
    // or the one specified in CMake Tools settings
    const presets = {
      version: 3,
      configurePresets: [
        {
          name: 'qt-debug',
          displayName: 'Qt Debug Configuration',
          description: 'Debug build using Qt with CMake Presets',
          binaryDir: buildDir,
          cacheVariables: {
            CMAKE_BUILD_TYPE: 'Debug',
            CMAKE_PREFIX_PATH: qtEnv.leaf
          }
        }
      ]
    };

    fs.writeFileSync(presetsPath, JSON.stringify(presets, null, 2), 'utf-8');
    console.log(
      'Created/Updated CMakePresets.json with CMAKE_PREFIX_PATH:',
      qtEnv.leaf
    );
    console.log('Using projectDir (Presets):', projectDir);

    // Wait for file system to settle after writing CMakePresets.json
    await delay(FS_SETTLE_DELAY_MS);
    await waitForVSCodeIdle();

    // Disable automatic configuration to have precise control over test flow
    // configureOnOpen would trigger configure before we can set the preset
    // automaticReconfigure would interfere with our explicit configure call
    await setCMakeConfigurationForPlatform(wsFolder, 'configureOnOpen', false);
    await setCMakeConfigurationForPlatform(
      wsFolder,
      'automaticReconfigure',
      false
    );

    // spy on error messages
    const errSpy = sb.spy(vscode.window, 'showErrorMessage');

    // Set the configure preset using the correct CMake Tools command
    console.log('Setting configure preset: qt-debug');
    await vscode.commands.executeCommand(
      'cmake.setConfigurePreset',
      'qt-debug'
    );
    await waitForVSCodeIdle();

    console.log('Running cmake.configure with presets...');
    const rcCfg =
      await vscode.commands.executeCommand<number>('cmake.configure');
    await waitForVSCodeIdle();
    expect(rcCfg, `cmake.configure failed (rc=${rcCfg})`).to.equal(0);

    // Confirm what CMake used
    if (process.env.QT_TEST_DEBUG === '1') {
      console.log('== WHAT CMAKE USED (Presets) ==');
      console.log(
        '  CMAKE_PREFIX_PATH =',
        readCMakeCacheVar(buildDir, 'CMAKE_PREFIX_PATH') ?? '<unknown>'
      );
    }

    // Build
    const rcBuild = await vscode.commands.executeCommand<number>('cmake.build');
    await waitForVSCodeIdle();
    expect(rcBuild, `cmake.build failed (rc=${rcBuild})`).to.equal(0);

    // Wait for build artifacts to be written to disk
    await delay(DISK_FLUSH_DELAY_MS);

    const bin =
      process.platform === 'win32' ? path.join('Debug', 'hello.exe') : 'hello';
    const outPath = path.join(buildDir, bin);
    console.log('Checking for binary at', outPath);

    expect(fs.existsSync(outPath), `Expected build artifact at ${outPath}`).to
      .be.true;
    expect(errSpy.called, 'Unexpected error popups during build').to.be.false;

    // Verify that SELECTED_QT_PATHS is set correctly in CoreAPI
    const coreAPI = await getCoreApi();
    if (!coreAPI) {
      throw new Error('CoreAPI is not available');
    }

    const selectedQtPaths = coreAPI.getValue<string>(
      wsFolder,
      CoreKey.SELECTED_QT_PATHS
    );
    console.log('CoreAPI SELECTED_QT_PATHS:', selectedQtPaths);

    // Get expected qtpaths from the Qt installation
    const expectedQtPaths = findQtPathsInInstallationPath(qtEnv.leaf);
    console.log('Expected qtpaths from installation:', expectedQtPaths);

    expect(selectedQtPaths, 'SELECTED_QT_PATHS should be set in CoreAPI').to.not
      .be.empty;
    expect(
      selectedQtPaths,
      'SELECTED_QT_PATHS should match the qtpaths executable in the Qt installation'
    ).to.equal(expectedQtPaths);

    // Cleanup: remove CMakePresets.json and reset useCMakePresets
    try {
      if (fs.existsSync(presetsPath)) {
        fs.unlinkSync(presetsPath);
      }
      await setCMakeConfigurationForPlatform(
        wsFolder,
        'useCMakePresets',
        undefined
      );
      await waitForVSCodeIdle();
    } catch (e) {
      console.warn('Cleanup warning:', e);
    }
  });
});

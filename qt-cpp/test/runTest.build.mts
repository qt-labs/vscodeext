// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import * as os from 'os';
import * as fsp from 'fs/promises';

import { downloadAndUnzipVSCode, runTests } from '@vscode/test-electron';

import {
  setupTestInfrastructure,
  setupVSCodeSettings,
  installRequiredExtensions,
  getPlatformCMakeGenerator
} from './runTestHelper.mjs';

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to --extensionDevelopmentPath
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');

    // The path to the extension test script
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, './suite/index-build');

    const vscodeExecutablePath = await downloadAndUnzipVSCode();

    const { qtRoot, localQtCoreVsix, cli, args, userDataDir } =
      await setupTestInfrastructure(vscodeExecutablePath);

    setupVSCodeSettings(userDataDir, qtRoot, {
      'cmake.configureOnOpen': false
    });
    const extensions = [
      { idOrVsix: 'ms-vscode.cmake-tools' },
      { idOrVsix: localQtCoreVsix }
    ];
    installRequiredExtensions(cli, args, extensions);

    // The workspace folder we want to open
    const projectDir = path.resolve(__dirname, '../../test/projectFolder');
    console.log('[runTest] Using project dir:', projectDir);
    const tmpWs = await fsp.mkdtemp(path.join(os.tmpdir(), 'qt-cpp-ws-'));
    const tmpProject = path.join(tmpWs, 'project');
    await fsp.mkdir(tmpProject, { recursive: true });
    // Node 16+: recursive copy
    await fsp.cp(projectDir, tmpProject, { recursive: true });
    console.log('[runTest] Copied project to temp dir:', tmpProject);

    // Set the generator in workspace settings before VS Code starts so that
    // a runtime cmake.generator change doesn't trigger a driver reload
    // before a kit is selected (which causes "No usable generator found").
    const wsSettingsPath = path.join(tmpProject, '.vscode', 'settings.json');
    const wsSettings = JSON.parse(await fsp.readFile(wsSettingsPath, 'utf-8'));
    wsSettings['cmake.generator'] = getPlatformCMakeGenerator();
    await fsp.writeFile(
      wsSettingsPath,
      JSON.stringify(wsSettings, null, 2),
      'utf-8'
    );

    // Run the integration tests (no need to pass launchArgs; we reused the same dirs)
    try {
      await runTests({
        launchArgs: [tmpProject, '--disable-workspace-trust'],
        extensionDevelopmentPath,
        extensionTestsPath
      });
    } finally {
      try {
        await fsp.rm(tmpWs, { recursive: true, force: true });
      } catch {}
    }
  } catch (e: Error | unknown) {
    console.error('Failed to run tests');
    console.error(e);
    process.exit(1);
  }
}

main();

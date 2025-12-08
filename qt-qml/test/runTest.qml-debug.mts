// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import * as os from 'os';
import * as fsp from 'fs/promises';

import { downloadAndUnzipVSCode, runTests } from '@vscode/test-electron';

import {
  setupVSCodeSettings,
  setupTestInfrastructure,
  installRequiredExtensions
} from './runTestHelper.mjs';
import type { ExtensionInstallInfo } from 'qt-lib/src/test-vscode-install.ts';

const IsWindows = process.platform === 'win32';

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to --extensionDevelopmentPath
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');

    // The path to the extension test script
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(
      __dirname,
      './suite/index-qml-debug'
    );

    // Download VS Code and resolve CLI/dirs using shared helper
    const vscodeExecutablePath = await downloadAndUnzipVSCode();
    const { qtRoot, localQtCoreVsix, cli, args, userDataDir } =
      await setupTestInfrastructure(vscodeExecutablePath);

    // Seed VS Code settings (shared helper + qml-debug-specific tweaks)
    setupVSCodeSettings(userDataDir, qtRoot, {
      // Extra qml-debug-specific settings
      'cmake.configureOnOpen': false,
      'cmake.buildBeforeRun': true,
      'cmake.saveBeforeConfiguration': false,
      // Disable QML language server to prevent it from crashing during build
      'qt-qml.qmlls.enabled': false
    });

    // Install core required extensions (CMake Tools + qt-core) via helper
    const extensions: ExtensionInstallInfo[] = [
      { idOrVsix: 'ms-vscode.cmake-tools' },
      { idOrVsix: localQtCoreVsix }
    ];
    if (IsWindows) {
      // On Windows, we also need qt-cpp for qt-cpp.qtDir for DLLs
      extensions.push({ idOrVsix: 'theqtcompany.qt-cpp' });
    }
    installRequiredExtensions(cli, args, extensions);

    // The workspace folder we want to open
    const projectDir = path.resolve(
      __dirname,
      '../../test/projectFolderQmlDebug'
    );
    console.log('[runTest.qml-debug] Using project dir:', projectDir);
    const tmpWs = await fsp.mkdtemp(path.join(os.tmpdir(), 'qt-qml-ws-'));
    const tmpProject = path.join(tmpWs, 'project');
    await fsp.mkdir(tmpProject, { recursive: true });
    // Node 16+: recursive copy
    await fsp.cp(projectDir, tmpProject, { recursive: true });
    console.log('[runTest.qml-debug] Copied project to temp dir:', tmpProject);

    // Run the integration tests
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
    console.error('[runTest.qml-debug] Failed to run tests');
    console.error(e);
    process.exit(1);
  }
}

main();

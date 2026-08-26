// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';

import { downloadAndUnzipVSCode, runTests } from '@vscode/test-electron';

import {
  setupTestInfrastructure,
  setupVSCodeSettings,
  installRequiredExtensions
} from './runTestHelper.mjs';
import {
  resolveVSCodeExecutable,
  getSharedVSCodeCachePath
} from '../../qt-lib/src/test-vscode-install.js';

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to --extensionDevelopmentPath
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');

    // The path to the extension test script
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    const cachePath = getSharedVSCodeCachePath(extensionDevelopmentPath);
    const vscodeExecutablePath = resolveVSCodeExecutable(
      await downloadAndUnzipVSCode({ cachePath }),
      cachePath
    );

    const { qtRoot, localQtCoreVsix, cli, args, userDataDir } =
      await setupTestInfrastructure(vscodeExecutablePath);

    setupVSCodeSettings(userDataDir, qtRoot);
    const extensions = [
      { idOrVsix: 'ms-vscode.cmake-tools' },
      { idOrVsix: localQtCoreVsix }
    ];
    installRequiredExtensions(cli, args, extensions);

    // Run the integration tests (no need to pass launchArgs; we reused the same dirs)
    await runTests({
      vscodeExecutablePath,
      extensionDevelopmentPath,
      extensionTestsPath
    });
  } catch (e: Error | unknown) {
    console.error('Failed to run tests');
    console.error(e);
    process.exit(1);
  }
}

main();

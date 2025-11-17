// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';

import { downloadAndUnzipVSCode, runTests } from '@vscode/test-electron';

import {
  setupTestInfrastructure,
  setupVSCodeSettings,
  installRequiredExtensions
} from './runTestHelper.mjs';

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to --extensionDevelopmentPath
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');

    // The path to the extension test script
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    const vscodeExecutablePath = await downloadAndUnzipVSCode();

    const { qtRoot, localQtCoreVsix, cli, args, userDataDir } =
      await setupTestInfrastructure(vscodeExecutablePath);

    setupVSCodeSettings(userDataDir, qtRoot);
    installRequiredExtensions(cli, args, localQtCoreVsix);

    // Run the integration tests (no need to pass launchArgs; we reused the same dirs)
    await runTests({
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

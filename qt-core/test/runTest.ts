// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

process.env.QT_TESTING = '1'; // in case pre-activation code uses the value before the extension host spins up
import * as cp from 'child_process';
import * as path from 'path';
const packageJson = require('../package.json');

import {
  downloadAndUnzipVSCode,
  resolveCliArgsFromVSCodeExecutablePath,
  runTests
} from '@vscode/test-electron';

async function main() {
  console.log('[runTest] setting QT_TESTING=1');
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');

    // The path to the extension test script
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    const vscodeExecutablePath = await downloadAndUnzipVSCode();
    const [cli, ...args] =
      resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);

    if (packageJson.extensionDependencies) {
      for (const extensionId of packageJson.extensionDependencies) {
        cp.spawnSync(cli!, [...args, '--install-extension', extensionId], {
          encoding: 'utf-8',
          stdio: 'inherit'
        });
      }
    }

    const launchArgs = ['--disable-workspace-trust'];

    // Download VS Code, unzip it and run the integration test
    await runTests({
      launchArgs,
      extensionDevelopmentPath,
      extensionTestsPath,
      extensionTestsEnv: {
        QT_TESTING: '1'
      }
    });
  } catch {
    console.error('Failed to run tests');
    process.exit(1);
  }
}

main();

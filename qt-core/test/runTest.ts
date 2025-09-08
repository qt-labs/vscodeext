// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as cp from 'child_process';
import * as path from 'path';
const packageJson = require('../package.json');

import {
  downloadAndUnzipVSCode,
  resolveCliArgsFromVSCodeExecutablePath,
  runTests
} from '@vscode/test-electron';

async function main() {
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
      extensionTestsPath
    });
  } catch {
    console.error('Failed to run tests');
    process.exit(1);
  }
}

main();

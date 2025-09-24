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

import {
  parseVSCodeDirs,
  getDebugLevel
} from '../../qt-lib/src/test-vscode-install.js';

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

    const { userDataDir, extensionsDir } = parseVSCodeDirs(args);
    if (getDebugLevel() >= 1) {
      console.log('[runTest][qt-core] CLI:', cli, 'args:', args.join(' '));
      console.log('[runTest][qt-core] userDataDir:', userDataDir);
      console.log('[runTest][qt-core] extensionsDir:', extensionsDir);
    }

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
  } catch (e: Error | unknown) {
    console.error('Failed to run tests');
    console.error(e);
    process.exit(1);
  }
}

main();

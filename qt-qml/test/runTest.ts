// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import * as fs from 'fs';

import {
  downloadAndUnzipVSCode,
  resolveCliArgsFromVSCodeExecutablePath,
  runTests
} from '@vscode/test-electron';

import {
  getLocalQtCore,
  getQuietVSCodeArgs
} from '../../qt-lib/src/test-constants';
import {
  parseVSCodeDirs,
  installExtensionWithRetry
} from '../../qt-lib/src/test-vscode-install.js';

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');

    // The path to the extension test script
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, './suite/index');
    // Path to the local qt-core extension to be used during testing
    const localQtCoreVsix = path.resolve(__dirname, getLocalQtCore());
    // Check that qt-core .vsix exists
    if (!fs.existsSync(localQtCoreVsix)) {
      console.error(`Required extension not found: ${localQtCoreVsix}`);
      process.exit(1); // Fail early
    }

    const vscodeExecutablePath = await downloadAndUnzipVSCode();
    const [cli, ...args] =
      resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);

    // Use the SAME profile/dirs that test-electron sets up
    const { userDataDir, extensionsDir } = parseVSCodeDirs(args);
    console.log('[runTest][qt-ui] CLI:', cli, 'args:', args.join(' '));
    console.log('[runTest][qt-ui] userDataDir:', userDataDir);
    console.log('[runTest][qt-ui] extensionsDir:', extensionsDir);

    const quietArgs = [...args, ...getQuietVSCodeArgs()];
    // Install qt-core VSIX into that profile
    installExtensionWithRetry(cli as string, quietArgs, localQtCoreVsix);

    // Download VS Code, unzip it and run the integration test
    await runTests({ extensionDevelopmentPath, extensionTestsPath });
  } catch (e: Error | unknown) {
    console.error('Failed to run tests');
    console.error(e);
    process.exit(1);
  }
}

main();

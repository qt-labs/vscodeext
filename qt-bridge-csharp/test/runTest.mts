// Copyright (C) 2026 The Qt Company Ltd.
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
} from '../../qt-lib/src/test-constants.js';
import {
  parseVSCodeDirs,
  installExtensionWithRetry,
  debugListExtensions,
  assertExtensionsInstalled,
  getDebugLevel
} from '../../qt-lib/src/test-vscode-install.js';

async function main() {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');
    const extensionTestsPath = path.resolve(__dirname, './suite/index');
    const localQtCoreVsix = path.resolve(__dirname, getLocalQtCore());
    if (!fs.existsSync(localQtCoreVsix)) {
      console.error(`Required extension not found: ${localQtCoreVsix}`);
      process.exit(1);
    }

    const vscodeExecutablePath = await downloadAndUnzipVSCode();
    const [cli, ...args] =
      resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);
    const { userDataDir, extensionsDir } = parseVSCodeDirs(args);
    if (getDebugLevel() >= 1) {
      console.log(
        '[runTest][qt-bridge-csharp] CLI:',
        cli,
        'args:',
        args.join(' ')
      );
      console.log(
        '[runTest][qt-bridge-csharp] userDataDir:',
        userDataDir
      );
      console.log(
        '[runTest][qt-bridge-csharp] extensionsDir:',
        extensionsDir
      );
    }

    const launchArgs = [...args];
    const quietArgs = [...args, ...getQuietVSCodeArgs()];
    installExtensionWithRetry(cli as string, quietArgs, {
      idOrVsix: localQtCoreVsix
    });
    debugListExtensions(cli as string, args);
    assertExtensionsInstalled(cli as string, args, [
      'theqtcompany.qt-core'
    ]);

    await runTests({
      vscodeExecutablePath,
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs,
      // Electron-based development shells may leak this into the test
      // runner, which would make the VS Code test executable start as
      // Node.js.
      extensionTestsEnv: { ELECTRON_RUN_AS_NODE: undefined }
    });
  } catch (error: Error | unknown) {
    console.error('Failed to run tests');
    console.error(error);
    process.exit(1);
  }
}

void main();

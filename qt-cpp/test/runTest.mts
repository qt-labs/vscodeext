// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import * as fs from 'fs';

const QT_INS_ROOT_CONFIG_NAME = 'qtInstallationRoot';

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

// --- CLI arg parsing (no deps) ---------------------------------------------
function getCliArg(name: string): string | undefined {
  const flag = `--${name}`;
  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const a: string = argv[i]!;
    if (a === flag) {
      const next = argv[i + 1];
      return next ? next.trim() : undefined;
    }
    if (a.startsWith(flag + '=')) {
      return a.slice(flag.length + 1).trim();
    }
  }
  return undefined;
}

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to --extensionDevelopmentPath
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');

    // The path to the extension test script
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, './suite/index');
    // Path to the local qt-core extension to be used during testing
    const localQtCoreVsix = path.normalize(
      path.resolve(__dirname, getLocalQtCore())
    );
    // Check that qt-core .vsix exists
    if (!fs.existsSync(localQtCoreVsix)) {
      console.error(`Required extension not found: ${localQtCoreVsix}`);
      process.exit(1); // Fail early
    }
    const vscodeExecutablePath = await downloadAndUnzipVSCode();
    const [cli, ...args] =
      resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);

    //--------------------
    // Read from env (set this when launching tests)
    // Prefer CLI over env
    const cliQtRoot = getCliArg('qt-root');
    const envQtRoot = process.env.QT_TEST_QT_ROOT?.trim();
    const qtRoot = (cliQtRoot ?? envQtRoot)?.trim();

    if (!qtRoot) {
      console.error(
        [
          'Qt root is required. Provide either:',
          '  1) CLI:   --qt-root /absolute/path/to/Qt',
          '  2) ENV:   QT_TEST_QT_ROOT=/absolute/path/to/Qt',
          '',
          'Examples:',
          '  npm run test -- --qt-root=/Users/me/Qt',
          '  QT_TEST_QT_ROOT=/Users/me/Qt npm run test'
        ].join('\n')
      );
      process.exit(1);
    }

    // Reuse the dirs that @vscode/test-electron already configured
    const { userDataDir, extensionsDir } = parseVSCodeDirs(args);
    if (getDebugLevel() >= 1) {
      console.log('[runTest][qt-cpp] CLI:', cli, 'args:', args.join(' '));
      console.log('[runTest][qt-cpp] userDataDir:', userDataDir);
      console.log('[runTest][qt-cpp] extensionsDir:', extensionsDir);
    }

    // Seed VS Code settings in that SAME user-data-dir
    if (!userDataDir) {
      console.error(
        '[runTest] Could not determine userDataDir from VS Code args.'
      );
      process.exit(1);
    }
    const userDir = path.join(userDataDir, 'User');
    fs.mkdirSync(userDir, { recursive: true });

    const settingsPath = path.join(userDir, 'settings.json');
    const settings = {
      // VS Code setting key that qt-core reads:
      [`qt-core.${QT_INS_ROOT_CONFIG_NAME}`]: qtRoot,
      // Silence CMake Tools logs (trace/debug/info/warn → only errors)
      'cmake.loggingLevel': 'error'
    };
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
    console.log('[runTest] Wrote settings to:', settingsPath);

    const quietArgs = [...args, ...getQuietVSCodeArgs()];
    const required = ['ms-vscode.cmake-tools', localQtCoreVsix];
    const requiredIds = ['ms-vscode.cmake-tools', 'theqtcompany.qt-core'];
    // Install required extensions into the SAME profile/dir combo
    for (const ext of required) {
      installExtensionWithRetry(cli as string, quietArgs, ext);
    }
    debugListExtensions(cli as string, args);
    assertExtensionsInstalled(cli as string, args, requiredIds);

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

// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs';
import * as path from 'path';
import { resolveCliArgsFromVSCodeExecutablePath } from '@vscode/test-electron';
import {
  getLocalQtCore,
  getQuietVSCodeArgs
} from '../../qt-lib/src/test-constants.js';
import {
  parseVSCodeDirs,
  installExtensionWithRetry,
  debugListExtensions,
  assertExtensionsInstalled,
  getDebugLevel,
  ExtensionInstallInfo
} from '../../qt-lib/src/test-vscode-install.js';

const QT_INS_ROOT_CONFIG_NAME = 'qtInstallationRoot';

/**
 * Parse a CLI argument by name (e.g., --qt-root or --qt-root=/path)
 */
export function getCliArg(name: string): string | undefined {
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

/**
 * Get and validate the Qt root path from CLI or environment
 */
export function getQtRoot(): string {
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

  return qtRoot;
}

/**
 * Verify that the required qt-core .vsix file exists
 */
export function verifyQtCoreVsix(): string {
  const localQtCoreVsix = path.normalize(
    path.resolve(__dirname, getLocalQtCore())
  );

  if (!fs.existsSync(localQtCoreVsix)) {
    console.error(`Required extension not found: ${localQtCoreVsix}`);
    process.exit(1);
  }

  return localQtCoreVsix;
}

/**
 * Setup VS Code settings for testing
 */
export function setupVSCodeSettings(
  userDataDir: string,
  qtRoot: string,
  additionalSettings: Record<string, unknown> = {}
): void {
  const userDir = path.join(userDataDir, 'User');
  fs.mkdirSync(userDir, { recursive: true });

  const settingsPath = path.join(userDir, 'settings.json');
  const settings = {
    [`qt-core.${QT_INS_ROOT_CONFIG_NAME}`]: qtRoot,
    'cmake.loggingLevel': 'error',
    ...additionalSettings
  };

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  console.log('[runTest.qml-debug] Wrote settings to:', settingsPath);
}

/**
 * Install required extensions for testing
 */
export function installRequiredExtensions(
  cli: string,
  args: string[],
  extensions: ExtensionInstallInfo[],
  requiredIDs: string[] = ['ms-vscode.cmake-tools', 'theqtcompany.qt-core']
): void {
  const quietArgs = [...args, ...getQuietVSCodeArgs()];

  for (const ext of extensions) {
    installExtensionWithRetry(cli, quietArgs, ext);
  }

  debugListExtensions(cli, args);
  assertExtensionsInstalled(cli, args, requiredIDs);
}

/**
 * Setup common test infrastructure
 */
export async function setupTestInfrastructure(
  vscodeExecutablePath: string
): Promise<{
  qtRoot: string;
  localQtCoreVsix: string;
  cli: string;
  args: string[];
  userDataDir: string;
  extensionsDir: string;
}> {
  const qtRoot = getQtRoot();
  const localQtCoreVsix = verifyQtCoreVsix();

  const [cli, ...args] =
    resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);

  const { userDataDir, extensionsDir } = parseVSCodeDirs(args);

  if (getDebugLevel() >= 1) {
    console.log('[runTest.qml-debug] CLI:', cli, 'args:', args.join(' '));
    console.log('[runTest.qml-debug] userDataDir:', userDataDir);
    console.log('[runTest.qml-debug] extensionsDir:', extensionsDir);
  }
  if (!userDataDir) {
    console.error(
      '[runTest.qml-debug] Could not determine userDataDir from VS Code args.'
    );
    process.exit(1);
  }

  if (!extensionsDir) {
    console.error(
      '[runTest.qml-debug] Could not determine extensionsDir from VS Code args.'
    );
    process.exit(1);
  }

  return {
    qtRoot,
    localQtCoreVsix,
    cli: cli!,
    args,
    userDataDir,
    extensionsDir
  };
}

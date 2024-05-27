// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { program } from 'commander';

import {
  downloadAndUnzipVSCode,
  resolveCliArgsFromVSCodeExecutablePath,
  runTests
} from '@vscode/test-electron';

// Note: These variables and functions are needed before the test environment
// They should be outside of the extension implementation
const Home = os.homedir();
const IsWindows = process.platform === 'win32';
const UserLocalDir = IsWindows
  ? process.env.LOCALAPPDATA ?? ''
  : path.join(Home, '.local/share');

const CMakeToolsDir = path.join(UserLocalDir, 'CMakeTools');

function saveCMakeToolsDir() {
  if (fs.existsSync(CMakeToolsDir)) {
    fs.renameSync(CMakeToolsDir, CMakeToolsDir + '_orig');
  }
}

function restoreCMakeToolsDir() {
  if (fs.existsSync(CMakeToolsDir)) {
    fs.rmSync(CMakeToolsDir, { recursive: true, force: true });
  }
  if (fs.existsSync(CMakeToolsDir + '_orig')) {
    fs.renameSync(CMakeToolsDir + '_orig', CMakeToolsDir);
  }
}

async function main() {
  try {
    program.option(
      '-p, --qt_path <string>',
      'Path to Qt installation directory'
    );
    program.parse(process.argv);
    const qt_path = program.opts().qt_path as string;

    const extensionDevelopmentPath = path.resolve(__dirname, '../../../');
    const extensionTestsPath = path.resolve(__dirname, './index');
    const vscodeExecutablePath = await downloadAndUnzipVSCode('stable');
    const [cliPath, ...args] =
      resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);
    if (!cliPath) {
      throw new Error('Failed to locate Code CLI');
    }
    const testWorkspace = path.resolve(
      extensionDevelopmentPath,
      'src/test/integration/project-folder'
    );
    const launchArgs = ['--disable-workspace-trust', testWorkspace];
    console.log('Running tests with the following arguments:');
    console.log(launchArgs);
    const extensionTestsEnv: Record<string, string | undefined> = {
      QT_PATH: qt_path,
      QT_TESTING: '1',
      CMT_QUIET_CONSOLE: '1'
    };
    cp.spawnSync(
      cliPath,
      [...args, '--install-extension', 'ms-vscode.cmake-tools'],
      {
        encoding: 'utf-8',
        stdio: 'inherit'
      }
    );
    saveCMakeToolsDir();
    await runTests({
      launchArgs: launchArgs,
      vscodeExecutablePath: vscodeExecutablePath,
      extensionDevelopmentPath: extensionDevelopmentPath,
      extensionTestsPath: extensionTestsPath,
      extensionTestsEnv: extensionTestsEnv
    });
    restoreCMakeToolsDir();
  } catch (err) {
    restoreCMakeToolsDir();
    console.error('Failed to run tests');
    process.exit(1);
  }
}

void main();

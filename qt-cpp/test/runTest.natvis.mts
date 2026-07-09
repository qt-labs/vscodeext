// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import * as os from 'os';
import * as fsp from 'fs/promises';

import { downloadAndUnzipVSCode, runTests } from '@vscode/test-electron';

import {
  setupVSCodeSettings,
  setupTestInfrastructure,
  installRequiredExtensions
} from './runTestHelper.mjs';

import { installStdioFilter } from './util/stdioFilter.mts';
const uninstallStdio = installStdioFilter();

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to --extensionDevelopmentPath
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');

    // The path to the extension test script
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, './suite/index-natvis');

    // Download VS Code and resolve CLI/dirs using shared helper
    const vscodeExecutablePath = await downloadAndUnzipVSCode();
    const { qtRoot, localQtCoreVsix, cli, args, userDataDir } =
      await setupTestInfrastructure(vscodeExecutablePath);

    // Seed VS Code settings (shared helper + natvis-specific tweaks)
    setupVSCodeSettings(userDataDir, qtRoot, {
      // Extra natvis-specific setting
      'cmake.configureOnOpen': false
    });

    // Install core required extensions (CMake Tools + qt-core) via helper
    const extensions = [
      { idOrVsix: 'ms-vscode.cmake-tools' },
      // Pre-release cpptools carries the debuginfod fix (>= 1.33.0,
      // MIEngine#1561). Stable cpptools makes gdb hang downloading separate
      // debug info from debuginfod on launch, so the debugger never reaches
      // the breakpoint. Workarounds (empty DEBUGINFOD_URLS, "set debuginfod
      // enabled off") were reported insufficient before this fix.
      // See https://github.com/microsoft/vscode-cpptools/issues/14458
      { idOrVsix: 'ms-vscode.cpptools', preRelease: true },
      { idOrVsix: localQtCoreVsix }
    ];
    installRequiredExtensions(cli, args, extensions);

    // The workspace folder we want to open
    const projectDir = path.resolve(
      __dirname,
      '../../test/projectFolderNatvis'
    );
    console.log('[runTest] Using project dir:', projectDir);
    const tmpWs = await fsp.mkdtemp(path.join(os.tmpdir(), 'qt-cpp-ws-'));
    const tmpProject = path.join(tmpWs, 'project');
    await fsp.mkdir(tmpProject, { recursive: true });
    // Node 16+: recursive copy
    await fsp.cp(projectDir, tmpProject, { recursive: true });
    console.log('[runTest] Copied project to temp dir:', tmpProject);

    // Run the integration tests (no need to pass launchArgs; we reused the same dirs)
    try {
      await runTests({
        launchArgs: [tmpProject, '--disable-workspace-trust'],
        extensionDevelopmentPath,
        extensionTestsPath
      });
    } finally {
      try {
        await fsp.rm(tmpWs, { recursive: true, force: true });
      } catch {}
    }
  } catch (e: Error | unknown) {
    console.error('Failed to run tests');
    console.error(e);
    process.exit(1);
  }
}

main().catch((e) => {
  try {
    uninstallStdio();
  } catch {}
  console.error(e);
  process.exit(1);
});

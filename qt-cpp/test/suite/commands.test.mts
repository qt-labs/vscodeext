// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';

import {
  setupSandboxLifecycleHooks,
  waitForVSCodeIdle,
  activateQtCpp
} from '../helper.mts';

describe('command: scanForQtKits', () => {
  let sb: sinon.SinonSandbox;
  setupSandboxLifecycleHooks(
    (_sb) => (sb = _sb),
    async () => activateQtCpp()
  );
  before(function () {
    const qtRoot =
      vscode.workspace
        .getConfiguration('qt-core')
        .get<string>('qtInstallationRoot') ?? '';
    if (!qtRoot) {
      throw new Error(
        'qt-core.qtInstallationRoot is not set.\n' +
          'Make sure you run tests via runTest.mts (with --qt-root / QT_TEST_QT_ROOT)\n' +
          'or configure it in your VS Code settings when debugging.'
      );
    }
  });

  // Function to run the command and wait for VS Code to be idle
  async function runScanForQtKitsCommand(): Promise<void> {
    await vscode.commands.executeCommand('qt-cpp.scanForQtKits');
    await waitForVSCodeIdle();
  }

  it('calls for cmake scan for kits command, on Windows', async () => {
    const stub = sb.stub(vscode.commands, 'executeCommand');
    await runScanForQtKitsCommand();

    if (process.platform === 'win32') {
      expect(
        stub.calledWith('cmake.scanForKits'),
        'Expected executeCommand to be called with "cmake.scanForKits" on Windows'
      ).to.be.true;
    } else {
      expect(
        stub.calledWith('cmake.scanForKits'),
        'Did not expect executeCommand to be called with "cmake.scanForKits" on non-Windows'
      ).to.be.false;
    }
  });

  it('shows the number of Qt installation found', async () => {
    const withProgressSpy = sb.spy(vscode.window, 'withProgress');

    await runScanForQtKitsCommand();

    expect(withProgressSpy.calledOnce, 'withProgress should be called once').to
      .be.true;
  });
});

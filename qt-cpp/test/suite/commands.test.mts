// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';

import { delay } from 'qt-lib';

import {
  setupSandboxLifecycleHooks,
  waitForVSCodeIdle,
  activateQtCpp,
  activateCMakeTools
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
  let spy: sinon.SinonSpy;
  before(async () => {
    // Spy BEFORE activation so any later calls are observed
    spy = sinon.spy(vscode.commands, 'executeCommand');
    await activateCMakeTools();
  });
  async function waitFor<T>(
    cond: () => T,
    timeoutMs = 5000,
    intervalMs = 50
  ): Promise<T> {
    const t0 = Date.now();
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const v = cond();
      if (v) return v;
      if (Date.now() - t0 > timeoutMs)
        throw new Error(`timeout waiting for condition`);
      await delay(intervalMs);
    }
  }

  it('calls for cmake scan for kits command, on Windows', async function () {
    if (process.platform !== 'win32') {
      this.skip(); // Only meaningful on Windows
    }

    await runScanForQtKitsCommand();

    // Give the extension a moment to dispatch the command
    await waitFor(
      () => spy.getCalls().some((c) => c.args?.[0] === 'cmake.scanForKits'),
      5000,
      50
    );

    // Extra diagnostics if it somehow fails again
    const seen = spy.getCalls().map((c) => c.args?.[0]);
    expect(
      seen.includes('cmake.scanForKits'),
      `Expected executeCommand('cmake.scanForKits') on Windows. Calls seen: ${JSON.stringify(seen)}`
    ).to.be.true;
  });

  it('shows the number of Qt installation found', async () => {
    const withProgressSpy = sb.spy(vscode.window, 'withProgress');

    await runScanForQtKitsCommand();

    expect(withProgressSpy.calledOnce, 'withProgress should be called once').to
      .be.true;
  });
});

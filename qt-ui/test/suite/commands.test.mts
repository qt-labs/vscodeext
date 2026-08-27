// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as fs from 'fs';

import { delay } from 'qt-lib';

import {
  setupSandboxLifecycleHooks,
  waitForVSCodeIdle,
  activateQtUi
} from '../helper.mts';

describe('command: openQtWidgetDesigner', () => {
  let sb: sinon.SinonSandbox;
  setupSandboxLifecycleHooks(
    (_sb) => (sb = _sb),
    async () => activateQtUi()
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
  async function runOpenWidgetDesignerCommand(): Promise<void> {
    await vscode.commands.executeCommand('qt-ui.openWidgetDesigner');
    await waitForVSCodeIdle();
  }

  it('picks a Designer and that path exists, triggers no "Qt Designer" error messages', async function () {
    const ext = vscode.extensions.getExtension('theqtcompany.qt-ui')!;
    const api = ext.isActive ? ext.exports : await ext.activate();
    const { lastSpawnedDesignerRef } = api as {
      lastSpawnedDesignerRef: { proc?: import('child_process').ChildProcess };
    };
    let selected: vscode.QuickPickItem | undefined;

    const quickPickStub = sb
      .stub(vscode.window, 'showQuickPick')
      .callsFake(async (items: any, _opts?: vscode.QuickPickOptions) => {
        // handle both array or Thenable defensively:
        const list = Array.isArray(items)
          ? items
          : Array.isArray(await items)
            ? await items
            : [];
        selected = list[0]; // auto-select first item
        return selected; // simulate user choice
      });

    // Spy on showErrorMessage
    const showErrorSpy = sb.spy(vscode.window, 'showErrorMessage');

    await runOpenWidgetDesignerCommand();
    await waitForVSCodeIdle();
    await new Promise((r) => setTimeout(r, 3000)); // add short delay to give time for possible error events to fire

    const proc = lastSpawnedDesignerRef.proc;
    expect(proc, 'Designer process should exist').to.exist;

    //Assert the quick pick was shown and we captured a selection
    expect(quickPickStub.called, 'quick pick should be shown').to.equal(true);
    expect(selected, 'a Designer version should be selected').to.exist;
    expect(
      typeof selected!.description,
      'selected description should be a path string'
    ).to.equal('string');

    // Filter only error messages mentioning "Qt Designer"
    const qtDesignerErrors = showErrorSpy
      .getCalls()
      .map((c) => c.args[0])
      .filter(
        (msg): msg is string =>
          typeof msg === 'string' &&
          msg.includes('Error while opening Qt Designer')
      );

    // Assert none of those occurred
    expect(
      qtDesignerErrors.length,
      `Unexpected "Qt Designer" error messages: ${qtDesignerErrors.join('; ')}`
    ).to.equal(0);

    //Check the selected path actually exists
    const path = selected!.description as string;
    expect(
      fs.existsSync(path),
      `designer path should exist on disk: ${path}`
    ).to.equal(true);

    if (proc && !proc.killed) {
      if (process.platform === 'win32') {
        // Windows: task kill the tree
        const { execFile } = await import('child_process');
        await new Promise<void>((resolve) => {
          execFile('taskkill', ['/PID', String(proc.pid), '/T', '/F'], () =>
            resolve()
          );
        });
      } else {
        // POSIX: SIGTERM then wait a bit
        proc.kill('SIGTERM');
        await Promise.race([
          new Promise((r) => proc.once('exit', r)),
          delay(3000)
        ]);
      }
    }
  });
});

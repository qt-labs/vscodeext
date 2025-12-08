// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { delay } from 'qt-lib';
import {
  setupSandboxLifecycleHooks,
  activateQtCore,
  activateQtQml,
  getWorkspaceFolderOrThrow,
  prepareCMakeQtEnvWithVersion,
  cleanBuildDir,
  cmakeConfigForWorkspace,
  waitForVSCodeIdle,
  CMakeConfigrator
} from '../helper.mts';
import {
  prepareQmlBreakpointsFromMarkers,
  addBreakpoints,
  makeQmlDebugConfig,
  startDebugAndWaitForStop,
  stopDebugSession,
  evaluateExpression
} from '../debug-helper.mts';

const FS_SETTLE_DELAY_MS = 500;
const DISK_FLUSH_DELAY_MS = 1000;

// ---------------------------------------------------------------------------
// QML Debugger Integration Tests
// ---------------------------------------------------------------------------
// This test suite validates QML debugging functionality including:
// 1. Breakpoint hits and stack traces
// 2. Variable evaluation via DAP evaluate request
// 3. Execution control (continue, step, etc.)
//
// Important notes about QML debugging:
// - QML object properties (counter, message, etc.) are NOT JavaScript local variables
// - They do NOT appear in DAP scopes (Global, Local, Closure scopes)
// - QML properties MUST be accessed via DAP 'evaluate' request
// - JavaScript local variables in QML functions DO appear in scopes
//
// Run with: QT_TEST_DEBUG=1 npm run test:qt-qml -- --qt-root="/path/to/Qt"
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Shared debug logging + sandbox lifecycle for this test file
// ---------------------------------------------------------------------------
const DEBUG = process.env.QT_TEST_DEBUG === '1';
const dlog = (...args: unknown[]) => {
  if (DEBUG) console.log(...args);
};

describe('QML Debugger integration', function () {
  this.timeout(150_000); // QML debugging can take longer
  let sb: sinon.SinonSandbox;
  let cmakeConfigurator: CMakeConfigrator = undefined!;

  setupSandboxLifecycleHooks(
    (_sb) => (sb = _sb),
    async () => {
      dlog('[qml-debug] Activating Qt extensions');
      await activateQtCore();
      await activateQtQml();
    }
  );

  before('configure and build QML project', async function () {
    const wsFolder = getWorkspaceFolderOrThrow();
    cmakeConfigurator = cmakeConfigForWorkspace(wsFolder);
    await cmakeConfigurator.set('useCMakePresets', 'always');
    await waitForVSCodeIdle();

    const projectDir = wsFolder.uri.fsPath;
    const buildDir = await cleanBuildDir(projectDir, 'build-qml-debug');

    const qtRoot = vscode.workspace
      .getConfiguration('qt-core')
      .get<string>('qtInstallationRoot');
    if (typeof qtRoot !== 'string' || qtRoot.trim() === '') {
      throw new Error('qt-core.qtInstallationRoot is not configured.');
    }

    const qtEnv = prepareCMakeQtEnvWithVersion({
      topLevel: qtRoot,
      verbose: true
    });

    const presetsPath = path.join(projectDir, 'CMakePresets.json');

    // Create CMake Presets with QML debugging flags
    const presets = {
      version: 3,
      configurePresets: [
        {
          name: 'qml-debug',
          displayName: 'QML Debug Configuration',
          description: 'Debug build with QML debugging enabled',
          binaryDir: buildDir,
          cacheVariables: {
            CMAKE_BUILD_TYPE: 'Debug',
            CMAKE_PREFIX_PATH: qtEnv.leaf
          }
        }
      ]
    };

    fs.writeFileSync(presetsPath, JSON.stringify(presets, null, 2), 'utf-8');
    console.log(
      '[qml-debug] Created CMakePresets.json with CMAKE_PREFIX_PATH:',
      qtEnv.leaf
    );
    console.log('[qml-debug] Using projectDir:', projectDir);

    // Wait for file system to settle
    await delay(FS_SETTLE_DELAY_MS);
    await waitForVSCodeIdle();

    // Disable automatic configuration
    await cmakeConfigurator.set('configureOnOpen', false);
    await cmakeConfigurator.set('automaticReconfigure', false);

    // Spy on error messages
    const errSpy = sb.spy(vscode.window, 'showErrorMessage');

    // Set the configure preset
    console.log('[qml-debug] Setting configure preset: qml-debug');
    await vscode.commands.executeCommand(
      'cmake.setConfigurePreset',
      'qml-debug'
    );
    await waitForVSCodeIdle();

    // Configure
    console.log('[qml-debug] Running cmake.configure...');
    const rcCfg =
      await vscode.commands.executeCommand<number>('cmake.configure');
    await waitForVSCodeIdle();
    expect(rcCfg, `cmake.configure failed (rc=${rcCfg})`).to.equal(0);

    // Build
    console.log('[qml-debug] Running cmake.build...');
    const rcBuild = await vscode.commands.executeCommand<number>('cmake.build');
    await waitForVSCodeIdle();
    expect(rcBuild, `cmake.build failed (rc=${rcBuild})`).to.equal(0);

    // Wait for build artifacts
    await delay(DISK_FLUSH_DELAY_MS);

    // Check for binary
    const bin =
      process.platform === 'win32'
        ? path.join('Debug', 'qml-debug-app.exe')
        : 'qml-debug-app';
    const outPath = path.join(buildDir, bin);
    console.log('[qml-debug] Checking for binary at', outPath);

    expect(fs.existsSync(outPath), `Expected build artifact at ${outPath}`).to
      .be.true;
    expect(errSpy.called, 'Unexpected error popups during build').to.be.false;
  });

  /**
   * Helper function to run a QML debug test with common setup/teardown
   */
  async function runQmlDebugTest(
    testFn: (
      session: vscode.DebugSession,
      stops: Array<{
        source?: string;
        line?: number;
        threadId?: number;
        frameId?: number;
      }>
    ) => Promise<void>
  ): Promise<void> {
    const wsFolder = getWorkspaceFolderOrThrow();
    const projectDir = wsFolder.uri.fsPath;

    const { breakpoints } = await prepareQmlBreakpointsFromMarkers(
      projectDir,
      'Main.qml',
      'BREAK_HERE'
    );

    const removeBps = addBreakpoints(breakpoints);
    await waitForVSCodeIdle();

    try {
      const debugConfig = await makeQmlDebugConfig();
      const { session, stops } = await startDebugAndWaitForStop(
        wsFolder,
        debugConfig,
        { timeoutMs: 60000 }
      );

      try {
        await testFn(session, stops);
      } finally {
        await stopDebugSession(session);
        await delay(500);
      }
    } finally {
      removeBps();
    }
  }

  it('hits breakpoint and validates stack trace', async function () {
    dlog('[qml-debug] Starting QML breakpoint and variable inspection');

    await runQmlDebugTest(async (session, stops) => {
      expect(stops.length, 'Should stop at a breakpoint').to.be.greaterThan(0);
      dlog(`[qml-debug] Stopped at ${stops.length} location(s)`);

      const stop = stops[0]!;
      dlog('[qml-debug] First stop:', {
        source: stop.source,
        line: stop.line,
        frameId: stop.frameId
      });

      // Verify we stopped in Main.qml
      expect(stop.source, 'Should stop in Main.qml').to.include('Main.qml');
      expect(stop.line, 'Should have line number').to.be.greaterThan(0);

      dlog('[qml-debug] Successfully hit QML breakpoint at line', stop.line);

      // Test basic debugging functionality is working
      expect(session, 'Debug session should be active').to.exist;
      expect(stop.threadId, 'Should have thread ID').to.exist;
      expect(stop.frameId, 'Should have frame ID').to.exist;
    });
  });

  it('can evaluate QML variable expressions', async function () {
    await runQmlDebugTest(async (session, stops) => {
      const stop = stops[0]!;
      const frameId = stop.frameId;

      dlog('[qml-debug] Testing variable evaluation at breakpoint');

      // Try to evaluate QML property expressions
      // Evaluate counter variable
      const counterResult = await evaluateExpression(
        session,
        'counter',
        frameId
      );
      dlog('[qml-debug] counter =', counterResult.result);

      // After the first breakpoint, counter should be 42
      expect(
        counterResult.result,
        'counter should be 42 after assignment'
      ).to.satisfy((val: string) => val === '42' || val.includes('42'));

      // Evaluate message variable
      const messageResult = await evaluateExpression(
        session,
        'message',
        frameId
      );
      dlog('[qml-debug] message =', messageResult.result);

      if (messageResult.result !== undefined) {
        expect(
          messageResult.result,
          'message should contain "Debug test running"'
        ).to.include('Debug test running');
      }

      // Evaluate items array
      const itemsResult = await evaluateExpression(session, 'items', frameId);
      dlog('[qml-debug] items =', itemsResult.result);
      // QML debugger returns "object" for complex types like arrays
      // Note: variablesReference is 0, so we cannot expand the object
      expect(
        itemsResult.result,
        'items should be returned as an object type'
      ).to.equal('object');
      expect(itemsResult.type, 'items type should be "object"').to.equal(
        'object'
      );

      // Evaluate isActive boolean
      const isActiveResult = await evaluateExpression(
        session,
        'isActive',
        frameId
      );
      dlog('[qml-debug] isActive =', isActiveResult.result);

      expect(isActiveResult.result, 'isActive should be true').to.satisfy(
        (val: string) => val === 'true' || val.includes('true')
      );

      // Try evaluating an expression
      const exprResult = await evaluateExpression(
        session,
        'counter + 1',
        frameId
      );
      dlog('[qml-debug] counter + 1 =', exprResult.result);

      if (exprResult.result !== undefined) {
        expect(exprResult.result, 'counter + 1 should be 43').to.satisfy(
          (val: string) => val === '43' || val.includes('43')
        );
      }

      dlog('[qml-debug] Successfully evaluated QML variables!');
    });
  });

  it('can retrieve stack trace information', async function () {
    await runQmlDebugTest(async (session, stops) => {
      const stop = stops[0]!;

      // Get full stack trace
      const threadId = stop.threadId ?? 1;
      const stackTrace = await session.customRequest('stackTrace', {
        threadId
      });

      dlog('[qml-debug] Stack trace:', JSON.stringify(stackTrace, null, 2));

      expect(stackTrace, 'Should have stack trace').to.exist;
      expect(stackTrace.stackFrames, 'Should have stack frames').to.be.an(
        'array'
      );
      expect(
        stackTrace.stackFrames.length,
        'Should have at least one frame'
      ).to.be.greaterThan(0);

      const topFrame = stackTrace.stackFrames[0];
      expect(topFrame.source, 'Frame should have source').to.exist;
      expect(topFrame.source.path, 'Frame source should have path').to.include(
        'Main.qml'
      );
      expect(topFrame.line, 'Frame should have line number').to.be.greaterThan(
        0
      );
      expect(topFrame.name, 'Frame should have name').to.be.a('string').and.not
        .empty;

      dlog('[qml-debug] Stack frame validated:', {
        source: topFrame.source.path,
        line: topFrame.line,
        name: topFrame.name
      });
    });
  });

  it('supports execution control (continue, step over, step in, and step out)', async function () {
    await runQmlDebugTest(async (session, stops) => {
      const stop = stops[0]!;
      expect(stop.threadId, 'Should have thread ID').to.exist;
      const threadId = stop.threadId!;

      // Helper to verify debugger stopped by checking stack trace
      const verifyDebuggerStopped = async (operation: string) => {
        const stackTrace = await session.customRequest('stackTrace', {
          threadId
        });
        expect(
          stackTrace.stackFrames,
          `${operation}: should have stack frames`
        ).to.be.an('array');
        expect(
          stackTrace.stackFrames.length,
          `${operation}: should have at least one frame`
        ).to.be.greaterThan(0);
        dlog(`[qml-debug] ${operation}: verified debugger stopped with stack`);
      };

      // Test continue
      dlog('[qml-debug] Testing continue');
      await session.customRequest('continue', { threadId });
      await delay(500);
      expect(
        vscode.debug.activeDebugSession,
        'Session should be active after continue'
      ).to.exist;

      // Pause to test stepping
      dlog('[qml-debug] Testing pause');
      await session.customRequest('pause', { threadId });
      await delay(500);
      await verifyDebuggerStopped('Pause');

      // Test step over (next)
      dlog('[qml-debug] Testing step over');
      await session.customRequest('next', { threadId });
      await delay(1000);
      await verifyDebuggerStopped('Step over');

      // Test step in
      dlog('[qml-debug] Testing step in');
      await session.customRequest('stepIn', { threadId });
      await delay(1000);
      await verifyDebuggerStopped('Step in');

      // Test step out
      dlog('[qml-debug] Testing step out');
      await session.customRequest('stepOut', { threadId });
      await delay(1000);
      await verifyDebuggerStopped('Step out');

      dlog(
        '[qml-debug] All execution control operations completed successfully'
      );
    });
  });

  after('cleanup CMake configuration', async function () {
    // Cleanup after all tests
    const wsFolder = getWorkspaceFolderOrThrow();
    const projectDir = wsFolder.uri.fsPath;
    const presetsPath = path.join(projectDir, 'CMakePresets.json');

    try {
      if (fs.existsSync(presetsPath)) {
        fs.unlinkSync(presetsPath);
      }
      await cmakeConfigurator.resetAll();
      await waitForVSCodeIdle();
    } catch (e) {
      console.warn('[qml-debug] Cleanup warning:', e);
    }
  });
});

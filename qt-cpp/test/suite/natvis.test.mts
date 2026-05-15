// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';

import {
  setupSandboxLifecycleHooks,
  waitForVSCodeIdle,
  activateQtCpp,
  readCMakeCacheVar,
  dlog
} from '../helper.mts';
import {
  prepareBreakpointsFromMarkers,
  addBreakpoints,
  makeCppDebugConfig,
  startDebugAndWaitForStop,
  stopDebugSession,
  getLocals,
  getQtCppSnippetDebugConfiguration,
  getFlattenedLocals,
  warmUpNatvisDisplay
} from '../debug-helper.mts';
import type { DebugVariable } from '../debug-helper.mts';
import {
  parseNatvisTypesWithAlternatives,
  materializeGoldenSnapshot,
  materializeLocalSnapshot
} from '../debug-golden.mts';
import { GOLDEN_ENTRIES } from '../debug-golden-entries.mts';
import {
  findMismatchedSnapshotEntries,
  formatValuePreview,
  printNatvisSummary
} from '../natvis-test-helper.mts';
import {
  configureAndBuildMinimalQtProject,
  materializeSnippetConfigForCurrentPlatform
} from '../configure-build-helper.mts';

/**
 * NatVis integration tests for the qt-cpp extension.
 *
 * This suite:
 *   - Configures and builds a minimal Qt CMake project using the selected Qt kit.
 *   - Launches the C++ debugger, stops on a marker breakpoint, and captures Locals.
 *   - Normalizes and filters Locals to a stable Snapshot model.
 *   - Compares the NatVis-formatted Locals against a hand-curated Golden snapshot,
 *     with per-entry knownProblem annotations for platform-specific breakage.
 *   - Optionally prints a NatVis coverage summary when NATVIS_SHOW_SUMMARY=1.
 *   - Runs a second, lighter test that uses the Qt debug configuration snippet
 *     (Qt: Debug with …) to launch and sanity-check a few key NatVis-formatted values.
 */

let sb: sinon.SinonSandbox;

setupSandboxLifecycleHooks(
  (_sb) => (sb = _sb),
  async () => activateQtCpp()
);

before('cpptools is installed and activated', async () => {
  // One-line environment summary for CI visibility.
  console.log(
    '[natvis.test] platform:',
    process.platform,
    '| arch:',
    process.arch,
    '| DEBUGINFOD_URLS:',
    process.env.DEBUGINFOD_URLS ?? '<unset>'
  );

  const ext = vscode.extensions.getExtension('ms-vscode.cpptools');
  expect(ext, 'ms-vscode.cpptools is not installed in the test host').to.exist;

  if (!ext!.isActive) {
    await ext!.activate(); // registers commands and the debug adapter
  }

  // Sanity: cpptools commands surfaced?
  const cmds = await vscode.commands.getCommands(true);
  const hasCpptoolsCmd =
    cmds.some((c) => /c_cpp\./i.test(c)) ||
    cmds.some((c) => /cpptools/i.test(c));

  expect(hasCpptoolsCmd, 'cpptools commands not visible after activation').to.be
    .true;

  // No extra probe here: the main test will fail if debugging cannot start.
});

// ---------------------------------------------------------------------------
// Snippet-based debug: lightweight sanity test using Qt debug snippets
// ---------------------------------------------------------------------------
describe('Debugging using Qt debug snippets (Qt: Debug with …)', function () {
  this.timeout(150_000);

  it('launches via Qt debug snippet and shows Locals formatted by our NatVis rules (lightweight sanity test)', async function () {
    const {
      wsFolder,
      projectDir,
      buildDir
      // kit, errSpy (already asserted in helper)
    } = await configureAndBuildMinimalQtProject(this, '[snippet-test]', sb);

    let session: vscode.DebugSession | undefined;
    let removeBps: (() => void) | undefined;

    try {
      // --- Set breakpoints in source file (same as golden test) --------
      const { doc, breakpoints } = await prepareBreakpointsFromMarkers(
        projectDir,
        'main.cpp',
        'BREAK_HERE'
      );
      removeBps = addBreakpoints(breakpoints);

      await waitForVSCodeIdle();

      const lines = doc.getText().split('\n');
      const markerIdxs = lines
        .map((ln, i) => (ln.includes('BREAK_HERE') ? i : -1))
        .filter((i) => i >= 0);

      expect(
        markerIdxs.length,
        '[snippet-test] No // BREAK_HERE markers found in source'
      ).to.be.greaterThan(0);

      dlog(
        '[snippet-test] CMAKE_BUILD_TYPE:',
        readCMakeCacheVar(buildDir, 'CMAKE_BUILD_TYPE')
      );
      dlog(
        '[snippet-test] cmake.buildConfig:',
        vscode.workspace.getConfiguration('cmake').get('buildConfig')
      );

      // --- Resolve NatVis and commands used by the snippet -------------
      const nvPath =
        await vscode.commands.executeCommand<string>('qt-cpp.natvis');
      dlog('[snippet-test] visualizer path:', nvPath);
      expect(
        nvPath,
        '[snippet-test] qt-cpp.natvis did not resolve to a path'
      ).to.be.a('string').and.not.empty;

      const program = await vscode.commands.executeCommand<string>(
        'cmake.launchTargetPath'
      );
      const cwd = await vscode.commands.executeCommand<string>(
        'cmake.getLaunchTargetDirectory'
      );

      expect(!!program, '[snippet-test] cmake.launchTargetPath did not resolve')
        .to.be.true;
      expect(
        !!cwd,
        '[snippet-test] cmake.getLaunchTargetDirectory did not resolve'
      ).to.be.true;

      // --- Build debug config from package.json snippet -----------------
      const snippetCfg = getQtCppSnippetDebugConfiguration();
      const platformCfg =
        materializeSnippetConfigForCurrentPlatform(snippetCfg);

      const cfg: vscode.DebugConfiguration = {
        ...platformCfg,
        // Force concrete paths for the test project, while keeping all
        // snippet-specific fields (MIMode, environment, sourceFileMap, etc.)
        program: program!,
        cwd: cwd!,
        visualizerFile: nvPath!
      };

      // Linux/GDB: disable debuginfod and use offscreen platform plugin
      if (process.platform === 'linux') {
        (cfg as any).setupCommands = [
          ...((cfg as any).setupCommands ?? []),
          {
            description: 'Disable debuginfod',
            text: 'set debuginfod enabled off',
            ignoreFailures: true
          }
        ];
        (cfg as any).environment = [
          ...((cfg as any).environment ?? []),
          { name: 'QT_QPA_PLATFORM', value: 'offscreen' }
        ];
      }

      if (process.env.QT_TEST_DEBUG === '1') {
        dlog(
          '[snippet-test] Debug config from snippet (after patching):',
          JSON.stringify(cfg, null, 2)
        );
      }

      console.log(
        '[snippet-test] launching debug:',
        cfg.type,
        '| MIMode:',
        (cfg as any).MIMode ?? '<none>',
        '| program:',
        cfg.program
      );
      const timeoutMs = 60000;
      const { session: s, stops } = await startDebugAndWaitForStop(
        wsFolder,
        cfg,
        { timeoutMs }
      );
      session = s;

      // --- Inspect backend for sanity ----------------------------------
      if (session) {
        const dbgType = session.type;
        const miMode = (session.configuration as any)?.MIMode;

        dlog('[snippet-test] Debugger backend:', dbgType);
        if (dbgType === 'cppdbg') {
          dlog('[snippet-test] MIMode:', miMode);
        }
      }

      expect(
        stops.length,
        '[snippet-test] Debugger did not stop on a breakpoint'
      ).to.be.greaterThan(0);
      dlog(
        '[snippet-test] stops:',
        stops.map((st) => `${st.source}:${st.line}`).join(', ')
      );

      const stop = stops[0]!;
      const frameId = stop.frameId!;
      const locals = await getLocals(session, frameId);
      dlog(
        '[snippet-test] Locals at top frame:',
        locals.map((v: any) => v.name).join(', ')
      );
      const flatLocals = await getFlattenedLocals(session, frameId);
      dlog(
        'Locals at top frame (flattened):',
        flatLocals.map((v: DebugVariable) => v.name).join(', ')
      );
      const vBA =
        flatLocals.find((v) => v.name === 'coreTypes.qByteArray') ??
        flatLocals.find((v) => v.name === 'qByteArray');
      const vStr =
        flatLocals.find((v) => v.name === 'coreTypes.qString') ??
        flatLocals.find((v) => v.name === 'qString');

      expect(vBA, '[snippet-test] qByteArray not found in Locals').to.exist;
      expect(vStr, '[snippet-test] qString not found in Locals').to.exist;

      // Make TS happy: if any is missing, bail out
      if (!vBA || !vStr) {
        throw new Error(
          '[snippet-test] Required locals missing despite existence checks'
        );
      }

      // Light NatVis sanity check: same idea as golden, but without golden compare
      expect(
        String(vStr.value),
        '[snippet-test] qString did not contain expected text'
      ).to.match(/Hello World!?/);
    } finally {
      removeBps?.();
      await stopDebugSession(session);
      await waitForVSCodeIdle();
    }
  });
});

// ---------------------------------------------------------------------------
// Main NatVis golden test
// ---------------------------------------------------------------------------
describe('natvis: minimal Qt project debug (index-natvis)', function () {
  this.timeout(150_000);

  it('reaches the breakpoint after configure+build and shows Locals formatted by our NatVis rules', async function () {
    const {
      wsFolder,
      projectDir,
      buildDir
      // errSpy (already asserted in the helper)
    } = await configureAndBuildMinimalQtProject(this, '[natvis.test]', sb);

    let session: vscode.DebugSession | undefined;
    let removeBps: (() => void) | undefined;

    try {
      // Set breakpoints in source file ---
      const { doc, breakpoints } = await prepareBreakpointsFromMarkers(
        projectDir,
        'main.cpp',
        'BREAK_HERE'
      );
      removeBps = addBreakpoints(breakpoints);

      // (optional) wait for VS Code to settle UI a tick
      await waitForVSCodeIdle();

      const lines = doc.getText().split('\n');

      // Quick check that the markers are present
      const markerIdxs = lines
        .map((ln, i) => (ln.includes('BREAK_HERE') ? i : -1))
        .filter((i) => i >= 0);

      expect(
        markerIdxs.length,
        'No // BREAK_HERE markers found in source'
      ).to.be.greaterThan(0);

      dlog(
        'CMAKE_BUILD_TYPE:',
        readCMakeCacheVar(buildDir, 'CMAKE_BUILD_TYPE')
      );
      dlog(
        'cmake.buildConfig:',
        vscode.workspace.getConfiguration('cmake').get('buildConfig')
      );
      // --- launch debugger and wait for stop ---
      const nvPath =
        await vscode.commands.executeCommand<string>('qt-cpp.natvis');
      dlog('[natvis.test] visualizer path:', nvPath);
      expect(nvPath, 'qt-cpp.natvis did not resolve to a path').to.be.a(
        'string'
      ).and.not.empty;

      const cfg = await makeCppDebugConfig();

      const wantAll =
        process.env.HIT_ALL_BREAKPOINTS === '1'
          ? breakpoints.length
          : undefined;
      const timeoutMs = 60000;
      const opts = {
        timeoutMs,
        ...(wantAll !== undefined ? { continueUntilHits: wantAll } : {})
      };
      const { session: s, stops } = await startDebugAndWaitForStop(
        wsFolder,
        cfg,
        opts
      );
      session = s;
      // --- Print debugger backend used -----------------------------
      if (session) {
        const dbgType = session.type; // 'cppdbg' or 'cppvsdbg'
        const miMode = session.configuration?.MIMode; // 'lldb' or 'gdb' (cppdbg only)

        dlog('[natvis.test] Debugger backend:', dbgType);
        if (dbgType === 'cppdbg') {
          dlog('[natvis.test] MIMode:', miMode);
        }
      }

      expect(
        stops.length,
        'Debugger did not stop on a breakpoint'
      ).to.be.greaterThan(0);
      dlog(
        '[natvis.test] stops:',
        stops.map((s) => `${s.source}:${s.line}`).join(', ')
      );

      const stop = stops[0]!;
      const frameId = stop.frameId!;
      // Warm up NatVis DisplayString evaluation: expand locals then issue a
      // Watch-context evaluate for each. This forces vsdbg to resolve deferred
      // DisplayString expressions before we read the final variable values.
      // (Windows/cppvsdbg only — no-op on other platforms.)
      await warmUpNatvisDisplay(session, frameId);
      // Fetch Locals from the top frame
      const locals = await getLocals(session, frameId);
      dlog('Locals at top frame:', locals.map((v: any) => v.name).join(', '));
      // Fetch Locals (including children) and flatten to dotted names
      const flatLocals = await getFlattenedLocals(session, frameId);
      dlog(
        'Locals at top frame (flattened):',
        flatLocals.map((v: DebugVariable) => v.name).join(', ')
      );

      //   Build full snapshot of Locals
      // Drop debugger noise we don't care about in the golden
      // (app / argc / argv are about process setup, not NatVis coverage)
      const noiseTopLevel = new Set(['app', 'argc', 'argv']);
      const snapshot = materializeLocalSnapshot(flatLocals).filter((v) => {
        const name = v.name;

        // Ignore anything without a proper name
        if (!name) {
          return false;
        }

        // Force top to be a string, never undefined
        const top: string = name.split('.')[0] || '';

        if (!top) {
          return false;
        }

        return !noiseTopLevel.has(top);
      });

      //   Read NatVis + compute which snapshot types are actually covered
      const natvisPath = nvPath; // you already computed this earlier
      const natvis = await parseNatvisTypesWithAlternatives(natvisPath);

      if (snapshot.length === 0) {
        throw new Error(
          '[natvis.test] No Locals matched any NatVis type; check project and NatVis path.'
        );
      }
      const goldenSnapshot = materializeGoldenSnapshot(
        GOLDEN_ENTRIES,
        process.platform
      );

      if (!goldenSnapshot) {
        throw new Error(
          `Golden not found. To create it run:\n  npm run natvis:golden:update`
        );
      }

      const { mismatches, statsByRoot } = findMismatchedSnapshotEntries(
        snapshot,
        goldenSnapshot,
        natvis
      );

      // ---- NatVis summary: which types worked, which NatVis types are unused ----
      const SHOW_SUMMARY = process.env.NATVIS_SHOW_SUMMARY === '1';

      if (SHOW_SUMMARY) {
        printNatvisSummary({
          goldenSnapshot,
          statsByRoot,
          natvis,
          natvisPath,
          wsFolder
        });
      }
      // ---- Final assertion: fail if any real mismatches remain ----
      if (mismatches.length > 0) {
        const MAX_VALUE_PREVIEW = 200;

        // type is not dictated by natvis, a perfect match is not expected
        const compactActual = mismatches.map((m) => ({
          name: m.name,
          present: m.actual !== undefined,
          type: m.actual?.type ?? m.expected?.type ?? '<unknown>',
          value: formatValuePreview(m.actual?.value)
        }));

        const compactExpected = mismatches.map((m) => ({
          name: m.name,
          present: true,
          type: m.actual?.type ?? m.expected?.type ?? '<unknown>',
          value: formatValuePreview(m.expected?.value)
        }));

        const names = mismatches.map((m) => m.name).join(', ');

        expect(
          compactActual,
          `NatVis mismatch (after filtering known-problem entries).\n` +
            `Variables with mismatches: ${names}\n` +
            `Values are truncated to ${MAX_VALUE_PREVIEW} characters for display.`
        ).to.deep.equal(compactExpected);
      }
    } finally {
      // cleanup always
      removeBps?.();
      await stopDebugSession(session);
      await waitForVSCodeIdle();
    }
  });
});

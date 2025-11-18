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
  waitForVSCodeIdle,
  activateQtCpp,
  getWorkspaceFolderOrThrow,
  cleanBuildDir,
  readCMakeCacheVar
} from '../helper.mts';
import {
  prepareBreakpointsFromMarkers,
  addBreakpoints,
  makeCppDebugConfig,
  startDebugAndWaitForStop,
  stopDebugSession,
  getLocals
} from '../debug-helper.mts';
import {
  toSnapshot,
  parseNatvisTypesWithAlternatives,
  collectTypesFromSnapshot,
  matchNatvisTypePatternsConsideringAlternatives,
  writeGolden,
  readGolden
} from '../debug-golden.mts';
import { selectAndApplyQtKit } from '../qt-kits-helper.mts';

function getRequiredQtMajorFromCMake(projectDir: string): number {
  const cmakeListsPath = path.join(projectDir, 'CMakeLists.txt');

  if (!fs.existsSync(cmakeListsPath)) {
    const message =
      `[natvis.test] CMakeLists.txt not found at ${cmakeListsPath}; ` +
      'cannot detect required Qt major version.';
    throw new Error(message);
  }

  const content = fs.readFileSync(cmakeListsPath, 'utf8');

  // Match e.g.:
  //   find_package(Qt6 REQUIRED COMPONENTS Core)
  //   find_package ( Qt5 CONFIG REQUIRED ... )
  const regex = /find_package\s*\(\s*Qt(\d+)\b[^)]*\)/i;
  const match = regex.exec(content);

  if (!match || !match[1]) {
    const message =
      '[natvis.test] Could not find a line like ' +
      '"find_package(Qt<major> ...)" in CMakeLists.txt; ' +
      'cannot determine required Qt major version.';
    throw new Error(message);
  }

  const majorStr = match[1];
  const major = Number.parseInt(majorStr, 10);

  if (Number.isNaN(major)) {
    const message =
      `[natvis.test] Could not parse Qt major version from '${majorStr}' ` +
      'in CMakeLists.txt.';
    throw new Error(message);
  }

  return major;
}

describe('natvis: minimal Qt project debug (index-natvis)', function () {
  this.timeout(150_000);

  let sb: sinon.SinonSandbox;

  setupSandboxLifecycleHooks(
    (_sb) => (sb = _sb),
    async () => activateQtCpp()
  );

  before('cpptools is installed and activated', async () => {
    const ext = vscode.extensions.getExtension('ms-vscode.cpptools');
    expect(ext, 'ms-vscode.cpptools is not installed in the test host').to
      .exist;

    if (!ext!.isActive) {
      await ext!.activate(); // registers commands and the debug adapter
    }

    // Sanity: cpptools commands surfaced?
    const cmds = await vscode.commands.getCommands(true);
    const hasCpptoolsCmd =
      cmds.some((c) => /c_cpp\./i.test(c)) ||
      cmds.some((c) => /cpptools/i.test(c));

    expect(hasCpptoolsCmd, 'cpptools commands not visible after activation').to
      .be.true;

    // No extra probe here: the main test will fail if debugging cannot start.
  });

  const DEBUG = process.env.QT_TEST_DEBUG === '1';
  const dlog = (...args: unknown[]) => {
    if (DEBUG) console.log(...args);
  };

  it('configures, builds, and stops at a breakpoint', async function () {
    const wsFolder = getWorkspaceFolderOrThrow();
    const projectDir = wsFolder.uri.fsPath;
    dlog('Using projectDir:', projectDir);
    const buildDir = await cleanBuildDir(projectDir);

    await vscode.commands.executeCommand('qt-cpp.scanForQtKits');
    await waitForVSCodeIdle();

    const requiredQtMajor = getRequiredQtMajorFromCMake(projectDir);

    const kit = await selectAndApplyQtKit(wsFolder, requiredQtMajor);

    if (!kit) {
      const message = '[natvis.test] No Qt kit available on this machine. ';
      if (process.env.CI) {
        // On CI: fail hard so we notice misconfiguration
        throw new Error(message);
      }
      // Local dev: skip this test cleanly
      this.skip();
    }
    dlog('Selected Qt kit:', kit);

    // spy on error messages
    const errSpy = sb.spy(vscode.window, 'showErrorMessage');

    // ... run cmake.configure / cmake.build / assertions ...
    dlog('Running cmake.configure...');
    const rcCfg =
      await vscode.commands.executeCommand<number>('cmake.configure');
    await waitForVSCodeIdle();
    expect(rcCfg, `cmake.configure failed (rc=${rcCfg})`).to.equal(0);

    // confirm what CMake used
    dlog('== WHAT CMAKE USED ==');
    dlog('  Qt6_DIR =', readCMakeCacheVar(buildDir, 'Qt6_DIR') ?? '<unknown>');

    const rcBuild = await vscode.commands.executeCommand<number>('cmake.build');
    await waitForVSCodeIdle();
    expect(rcBuild, `cmake.build failed (rc=${rcBuild})`).to.equal(0);

    await delay(400); // flush to disk

    const bin = process.platform === 'win32' ? 'hello.exe' : 'hello';
    const outPath = path.join(buildDir, bin);
    dlog('Checking for binary at', outPath);

    expect(fs.existsSync(outPath), `Expected build artifact at ${outPath}`).to
      .be.true;
    expect(errSpy.called, 'Unexpected error popups during build').to.be.false;

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
      // Fetch Locals from the top frame
      const locals = await getLocals(session, frameId);
      dlog('Locals at top frame:', locals.map((v: any) => v.name).join(', '));

      // Grab variables
      const vRect = locals.find((v: any) => v.name === 'qRect');
      const vBA = locals.find((v: any) => v.name === 'qByteArray');
      const vStr = locals.find((v: any) => v.name === 'qString');
      dlog('Rectangle from Locals:', vRect);

      //--------------------------------- temp test ------------------------------------------------
      expect(vRect, 'qRect not found in Locals').to.exist;
      expect(vBA, 'qByteArray not found in Locals').to.exist;
      expect(vStr, 'qString not found in Locals').to.exist;

      // NatVis proof
      expect(String(vRect.value)).to.match(/height.*/i);

      // Optional: sanity on values (keep regex tolerant across adapters)
      expect(String(vRect.value)).to.match(/x\s*=\s*5/i);
      expect(String(vRect.value)).to.match(/y\s*=\s*5/i);
      expect(String(vRect.value)).to.match(/width\s*=\s*42/i);
      expect(String(vStr.value)).to.match(/Hello World!?/);
      //---------------------------------------------------------------------------------

      //   Build full snapshot of Locals
      const snapshot = toSnapshot(locals);

      //   Read NatVis + compute which snapshot types are actually covered
      const natvisPath = nvPath; // you already computed this earlier
      const natvis = await parseNatvisTypesWithAlternatives(natvisPath);
      const seenTypes = collectTypesFromSnapshot(snapshot);

      // Now returns BOTH:
      //   - missing: NatVis type patterns not exercised
      //   - coveredTypes: set of snapshot.type strings that matched some NatVis type
      const { missing, coveredTypes } =
        matchNatvisTypePatternsConsideringAlternatives(natvis, seenTypes);

      // Keep only locals whose type is covered by NatVis
      const natvisSnapshot = snapshot.filter((v) => {
        if (!v.type) {
          return false;
        }
        return coveredTypes.has(v.type);
      });
      if (natvisSnapshot.length === 0) {
        throw new Error(
          '[natvis.test] No Locals matched any NatVis type; check project and NatVis path.'
        );
      }

      if (process.env.UPDATE_NATVIS_GOLDEN) {
        // Golden only contains NatVis-covered locals
        await writeGolden(natvisSnapshot);
      } else {
        const golden = await readGolden<typeof natvisSnapshot>(projectDir);

        if (!golden) {
          throw new Error(
            `Golden not found. To create it run:\n  npm run natvis:golden:update`
          );
        }

        // Compare ONLY NatVis-covered types (qRect, qByteArray, qString, etc.)
        expect(
          natvisSnapshot,
          'Locals mismatch vs golden (NatVis-covered types only)'
        ).to.deep.equal(golden);

        //    Coverage warning/error still based on full NatVis coverage
        const SHOW_COVERAGE_MISSING = process.env.NATVIS_SHOW_MISSING === '1';
        if (missing.length && SHOW_COVERAGE_MISSING) {
          const lines = missing.map((base) => {
            const alts = natvis.alts.get(base);
            return alts && alts.size
              ? `- ${base} (alts: ${[...alts].join(', ')})`
              : `- ${base}`;
          });
          console.warn(
            `[natvis.coverage] Missing types not exercised:\n${lines.join('\n')}`
          );
        }
      }
    } finally {
      // cleanup always
      removeBps?.();
      await stopDebugSession(session);
      await waitForVSCodeIdle();
    }
  });
});

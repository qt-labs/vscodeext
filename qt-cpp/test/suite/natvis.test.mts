// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { isDeepStrictEqual } from 'util';

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
  getLocals,
  getQtCppSnippetDebugConfiguration,
  getFlattenedLocals
} from '../debug-helper.mts';
import type { DebugVariable } from '../debug-helper.mts';
import {
  toSnapshot,
  parseNatvisTypesWithAlternatives,
  collectTypesFromSnapshot,
  matchNatvisTypePatternsConsideringAlternatives,
  writeGolden,
  readGolden,
  knownNatvisProblems,
  KnownNatvisProblem
} from '../debug-golden.mts';
import { selectAndApplyQtKit } from '../qt-kits-helper.mts';
import { forEach } from 'lodash';

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

function materializeSnippetConfigForCurrentPlatform(
  base: vscode.DebugConfiguration
): vscode.DebugConfiguration {
  const isWin = process.platform === 'win32';
  const isMac = process.platform === 'darwin';
  const platformKey = isWin ? 'windows' : isMac ? 'osx' : 'linux';

  const platformOverrides = (base as any)[platformKey] as
    | Record<string, unknown>
    | undefined;

  const merged: vscode.DebugConfiguration = {
    ...base,
    ...(platformOverrides ?? {})
  };

  // Once merged, drop the nested platform blocks so we end up with the
  // same shape the debug service would see.
  delete (merged as any).linux;
  delete (merged as any).osx;
  delete (merged as any).windows;

  return merged;
}

// ---------------------------------------------------------------------------
// Shared debug logging + sandbox lifecycle for this test file
// ---------------------------------------------------------------------------
const DEBUG = process.env.QT_TEST_DEBUG === '1';
const dlog = (...args: unknown[]) => {
  if (DEBUG) console.log(...args);
};

let sb: sinon.SinonSandbox;

setupSandboxLifecycleHooks(
  (_sb) => (sb = _sb),
  async () => activateQtCpp()
);

before('cpptools is installed and activated', async () => {
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
// Shared helper: configure + build minimal Qt project and select Qt kit
// ---------------------------------------------------------------------------
type ConfigureResult = {
  wsFolder: vscode.WorkspaceFolder;
  projectDir: string;
  buildDir: string;
  kit: string;
  errSpy: sinon.SinonSpy;
};

async function configureAndBuildMinimalQtProject(
  ctx: { skip(): void },
  logPrefix: string
): Promise<ConfigureResult> {
  const wsFolder = getWorkspaceFolderOrThrow();
  const projectDir = wsFolder.uri.fsPath;
  dlog(`${logPrefix} Using projectDir:`, projectDir);

  const buildDir = await cleanBuildDir(projectDir);

  // Ensure Qt kit is available and applied
  await vscode.commands.executeCommand('qt-cpp.scanForQtKits');
  await waitForVSCodeIdle();

  const requiredQtMajor = getRequiredQtMajorFromCMake(projectDir);
  const kit = await selectAndApplyQtKit(wsFolder, requiredQtMajor);

  if (!kit) {
    const message = `${logPrefix} No Qt kit available on this machine. `;
    if (process.env.CI) {
      // On CI: fail hard so we notice misconfiguration
      throw new Error(message);
    }
    // Local dev: skip this test cleanly
    ctx.skip();
    // TS: unreachable at runtime, but keeps the type checker happy
    throw new Error('Test skipped');
  }

  dlog(`${logPrefix} Selected Qt kit:`, kit);

  // Spy on error popups during configure/build
  const errSpy = sb.spy(vscode.window, 'showErrorMessage');

  // ---- configure + build --------------------------------------------
  dlog(`${logPrefix} Running cmake.configure...`);
  const rcCfg = await vscode.commands.executeCommand<number>('cmake.configure');
  await waitForVSCodeIdle();
  expect(rcCfg, `${logPrefix} cmake.configure failed (rc=${rcCfg})`).to.equal(
    0
  );

  dlog(`${logPrefix} == WHAT CMAKE USED ==`);
  dlog(
    `${logPrefix}   Qt6_DIR =`,
    readCMakeCacheVar(buildDir, 'Qt6_DIR') ?? '<unknown>'
  );

  const rcBuild = await vscode.commands.executeCommand<number>('cmake.build');
  await waitForVSCodeIdle();
  expect(rcBuild, `${logPrefix} cmake.build failed (rc=${rcBuild})`).to.equal(
    0
  );

  await delay(400); // flush to disk

  const bin = process.platform === 'win32' ? 'hello.exe' : 'hello';
  const outPath = path.join(buildDir, bin);
  dlog(`${logPrefix} Checking for binary at`, outPath);

  expect(
    fs.existsSync(outPath),
    `${logPrefix} Expected build artifact at ${outPath}`
  ).to.be.true;
  expect(errSpy.called, `${logPrefix} Unexpected error popups during build`).to
    .be.false;

  return { wsFolder, projectDir, buildDir, kit, errSpy };
}

function matchesPlatform(
  problem: KnownNatvisProblem,
  current: NodeJS.Platform
): boolean {
  const p = problem.platform;

  if (!p) {
    // No restriction → applies everywhere
    return true;
  }

  if (Array.isArray(p)) {
    return p.includes(current);
  }

  return p === current;
}
/**
 * Compare two NatVis snapshots (actual vs golden) and return only the
 * *real* mismatches. This comparison is aware of "known NatVis problems":
 *
 *   - If a mismatched entry corresponds to a type listed in
 *     knownNatvisProblems → the mismatch is *ignored* (not returned)
 *     and a debug message is printed explaining the known issue.
 *
 *   - If a known-problem type appears in the actual snapshot but does
 *     NOT mismatch the golden → a “good news” debug message is printed,
 *     indicating that the problematic NatVis rule is now fixed.
 *
 *   - If a known-problem type does *not* appear in the actual snapshot
 *     at all → a debug warning is printed to indicate that the sample
 *     no longer covers that type (possibly accidental).
 *
 * Behavior summary:
 *   1. Unknown mismatches → returned for the test to fail.
 *   2. Known-problem mismatches → filtered out + logged.
 *   3. Known-problem matches → logged as “fixed”.
 *   4. Known-problem missing from snapshot → logged as “no longer present”.
 *
 * Output:
 *   Returns an array of only the real, unexpected mismatches:
 *     [{ index, actual, expected }, …]
 *
 * This allows the test to remain strict while still remaining stable and
 * informative when NatVis rules are known to be broken on certain types.
 */
export function findMismatchedSnapshotEntries(
  actual: any[],
  expected: any[]
): Array<{ index: number; actual: any; expected: any }> {
  const mismatches: Array<{ index: number; actual: any; expected: any }> = [];
  const len = Math.max(actual.length, expected.length);

  // Track presence of problematic types
  const actualTypes = new Set(actual.map((v) => v?.type).filter(Boolean));

  // Track which known-problem types had mismatches
  const problematicTypesWithMismatch = new Set<string>();

  // ---- Main mismatch detection loop ------------------------------------
  for (let i = 0; i < len; i++) {
    const a = actual[i];
    const e = expected[i];

    // If equal → no issue
    if (isDeepStrictEqual(a, e)) continue;

    const t = a?.type ?? e?.type ?? undefined;

    const problem = t
      ? knownNatvisProblems.find(
          (p) => p.type === t && matchesPlatform(p, process.platform)
        )
      : undefined;

    if (problem) {
      // Known problem mismatch → ignore but record
      problematicTypesWithMismatch.add(t!);

      if (process.env.QT_TEST_DEBUG === '1') {
        console.warn(
          `[natvis.test][known-problem] '${t}' mismatch ignored — still broken.\n` +
            `  Reason: ${problem.description}`
        );
      }
      continue;
    }

    // Unknown mismatch → real failure
    mismatches.push({ index: i, actual: a, expected: e });
  }

  // ---- Post-analysis reporting (debug mode only) -----------------------
  if (process.env.QT_TEST_DEBUG === '1') {
    for (const prob of knownNatvisProblems) {
      const t = prob.type;

      // Skip problems that are not relevant on this platform
      if (!matchesPlatform(prob, process.platform)) {
        continue;
      }

      const seenInActual = actualTypes.has(t);
      const hadMismatch = problematicTypesWithMismatch.has(t);

      if (seenInActual && hadMismatch) {
        // Known problem still broken — already logged above
        continue;
      }

      if (seenInActual && !hadMismatch) {
        // GOOD NEWS → actual contains the type but mismatch did not happen
        console.warn(
          `[natvis.test][good-news] Known problem '${t}' no longer mismatches on ` +
            `${process.platform}!\n` +
            `  Description was: ${prob.description}`
        );
      }

      if (!seenInActual) {
        console.warn(
          `[natvis.test][warning] Known-problem type '${t}' (platform=${String(
            prob.platform ?? 'all'
          )}) no longer appears in Locals.\n` +
            `  (Maybe it's no longer constructed or NatVis expansion changed?)`
        );
      }
    }
  }

  return mismatches;
}

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
    } = await configureAndBuildMinimalQtProject(this, '[natvis.test]');

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
      const snapshot = toSnapshot(flatLocals).filter((v) => {
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

        //Compare ONLY NatVis-covered types (qRect, qByteArray, qString, etc.)
        //  expect(
        //    natvisSnapshot,
        //    'Locals mismatch vs golden (NatVis-covered types only)'
        //  ).to.deep.equal(golden);

        const mismatches = findMismatchedSnapshotEntries(
          natvisSnapshot,
          golden
        );
        forEach(mismatches, (m) => {
          console.error(
            `[natvis.test] Mismatch at index ${m.index}:\n` +
              `  Actual:   ${JSON.stringify(m.actual)}\n` +
              `  Expected: ${JSON.stringify(m.expected)}`
          );
        });

        if (mismatches.length > 0) {
          const MAX_VALUE_PREVIEW = 200;

          const preview = (v: unknown): string => {
            const raw =
              typeof v === 'string'
                ? v
                : v === undefined
                  ? 'undefined'
                  : JSON.stringify(v);

            if (raw.length <= MAX_VALUE_PREVIEW) {
              return raw;
            }
            return `${raw.slice(0, MAX_VALUE_PREVIEW)}… [truncated, len=${raw.length}]`;
          };

          const compactActual = mismatches.map((m) => {
            const actual = m.actual ?? {};
            const expected = m.expected ?? {};

            return {
              index: m.index,
              name:
                (actual as any).name ??
                (expected as any).name ??
                `<index ${m.index}>`,
              type:
                (actual as any).type ?? (expected as any).type ?? '<unknown>',
              value: preview((actual as any).value)
            };
          });

          const compactExpected = mismatches.map((m) => {
            const actual = m.actual ?? {};
            const expected = m.expected ?? {};

            return {
              index: m.index,
              name:
                (actual as any).name ??
                (expected as any).name ??
                `<index ${m.index}>`,
              type:
                (actual as any).type ?? (expected as any).type ?? '<unknown>',
              value: preview((expected as any).value)
            };
          });

          const indices = mismatches.map((m) => m.index).join(', ');

          expect(
            compactActual,
            `NatVis mismatch (after filtering known-problem types).\n` +
              `Mismatches at indices: ${indices}\n` +
              `Values are truncated to ${MAX_VALUE_PREVIEW} characters for display.`
          ).to.deep.equal(compactExpected);
        }
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
    } = await configureAndBuildMinimalQtProject(this, '[snippet-test]');

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

      if (process.env.QT_TEST_DEBUG === '1') {
        dlog(
          '[snippet-test] Debug config type:',
          cfg.type,
          'MIMode:',
          (cfg as any).MIMode ?? '<none>',
          'miDebuggerPath:',
          (cfg as any).miDebuggerPath ?? '<none>'
        );
      }

      console.log(
        '[snippet-test] Debug config from snippet (after patching):',
        JSON.stringify(cfg, null, 2)
      );
      const fsExists = fs.existsSync(cfg.program ?? '');
      console.log(
        '[snippet-test] program exists?',
        fsExists,
        'program =',
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
      const vRect =
        flatLocals.find((v) => v.name === 'coreTypes.qRect') ??
        flatLocals.find((v) => v.name === 'qRect');
      const vBA =
        flatLocals.find((v) => v.name === 'coreTypes.qByteArray') ??
        flatLocals.find((v) => v.name === 'qByteArray');
      const vStr =
        flatLocals.find((v) => v.name === 'coreTypes.qString') ??
        flatLocals.find((v) => v.name === 'qString');

      expect(vRect, '[snippet-test] qRect not found in Locals').to.exist;
      expect(vBA, '[snippet-test] qByteArray not found in Locals').to.exist;
      expect(vStr, '[snippet-test] qString not found in Locals').to.exist;

      // Make TS happy: if any is missing, bail out
      if (!vRect || !vBA || !vStr) {
        throw new Error(
          '[snippet-test] Required locals missing despite existence checks'
        );
      }

      // Light NatVis sanity check: same idea as golden, but without golden compare
      expect(
        String(vRect.value),
        '[snippet-test] qRect value does not look NatVis-formatted'
      ).to.match(/height.*/i);

      expect(
        String(vRect.value),
        '[snippet-test] qRect.x did not match expected NatVis output'
      ).to.match(/x\s*=\s*5/i);
      expect(
        String(vRect.value),
        '[snippet-test] qRect.y did not match expected NatVis output'
      ).to.match(/y\s*=\s*6/i);
      expect(
        String(vRect.value),
        '[snippet-test] qRect.width did not match expected NatVis output'
      ).to.match(/width\s*=\s*41/i);
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

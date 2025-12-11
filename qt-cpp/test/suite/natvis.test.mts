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
  getLocals,
  getQtCppSnippetDebugConfiguration,
  getFlattenedLocals
} from '../debug-helper.mts';
import type { DebugVariable } from '../debug-helper.mts';
import {
  NatvisTypes,
  Snapshot,
  GoldenSnapshot,
  parseNatvisTypesWithAlternatives,
  collectTypesFromSnapshot,
  matchNatvisTypePatternsConsideringAlternatives,
  materializeGoldenSnapshot,
  materializeLocalSnapshot
} from '../debug-golden.mts';
import { GOLDEN_ENTRIES } from '../debug-golden-entries.mts';
import { selectAndApplyQtKit } from '../qt-kits-helper.mts';

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

/**
 * Returns a short, human-readable preview of any debugger value.
 * - Strings are kept as-is (truncated if long).
 * - Non-strings are JSON-stringified.
 * - Undefined becomes the literal "undefined".
 * - Long values are truncated with an indicator.
 */
function formatValuePreview(v: unknown, max: number = 200): string {
  let raw: string;

  if (typeof v === 'string') {
    raw = v;
  } else if (v === undefined) {
    raw = 'undefined';
  } else {
    try {
      raw = JSON.stringify(v);
    } catch {
      raw = String(v);
    }
  }

  if (raw.length <= max) {
    return raw;
  }

  return `${raw.slice(0, max)}… [truncated, len=${raw.length}]`;
}

/**
 * Print a human-readable NatVis coverage summary to the test log.
 *
 * This function is purely diagnostic: it does not affect test pass/fail,
 * it only reports what the current snapshot and golden tell us.
 *
 * It reports three main things:
 *
 *   1) **Successfully covered types**
 *      - Starts from `natvisSnapshot` (locals that passed through NatVis
 *        filtering and normalization).
 *      - Collects all distinct `type` values that actually appeared.
 *      - Removes:
 *          • types that had real mismatches (after filtering knownProblem),
 *          • types that are marked as `knownProblem` anywhere in the
 *            `goldenSnapshot` (including nested children).
 *      - The remaining types are printed as:
 *          "Tested Qt types successfully covered by NatVis file ..."
 *
 *   2) **Known-problem types (from the golden snapshot)**
 *      - Walks the entire `goldenSnapshot` tree recursively.
 *      - Any entry with a non-empty `knownProblem` and a `type` is recorded.
 *      - These types are printed as:
 *          "Tested Qt types with unsuccessful NatVis coverage
 *           (marked as knownProblem in the golden snapshot)"
 *      - This reflects the new model where problem annotations live in the
 *        golden rather than a separate global table.
 *
 *   3) **NatVis patterns that were not exercised**
 *      - Uses `natvis` and `missing` (the coverage result from
 *        matchNatvisTypePatternsConsideringAlternatives).
 *      - For each missing base pattern, shows the base name and its
 *        AlternativeType patterns (if any).
 *      - This tells you which NatVis rules exist in the .natvis file but
 *        did not appear in the current test snapshot.
 *
 * Additional details:
 *   - `natvisPath` and `wsFolder` are used to print the NatVis file path
 *     relative to the workspace root, for nicer logs.
 *   - `mismatches` is the final list returned by findMismatchedSnapshotEntries
 *     (after knownProblem filtering). It is used only to compute the set of
 *     "real mismatched types".
 *   - The function is intended to be called once at the end of the NatVis
 *     test when NATVIS_SHOW_SUMMARY (or similar) is enabled.
 *
 * @param params.natvisSnapshot  Platform-normalized locals after NatVis filtering.
 * @param params.goldenSnapshot  Platform-resolved golden snapshot (with knownProblem).
 * @param params.mismatches      Real mismatches returned by the comparison logic.
 * @param params.natvis          Parsed NatVis type information (bases, alts, all).
 * @param params.missing         NatVis base patterns not exercised by this snapshot.
 * @param params.natvisPath      Absolute path to the NatVis file, or undefined.
 * @param params.wsFolder        Workspace folder used to relativize natvisPath.
 */
export function printNatvisSummary(params: {
  natvisSnapshot: readonly Snapshot[];
  goldenSnapshot: readonly GoldenSnapshot[];
  mismatches: readonly SnapshotMismatch[];
  natvis: NatvisTypes;
  missing: readonly string[];
  natvisPath: string | undefined;
  wsFolder: vscode.WorkspaceFolder;
}): void {
  const {
    natvisSnapshot,
    goldenSnapshot,
    mismatches,
    natvis,
    missing,
    natvisPath,
    wsFolder
  } = params;

  // Collect types that actually appeared in the NatVis-filtered snapshot
  const allCoveredTypes = new Set<string>(
    natvisSnapshot.map((v) => v.type).filter((t): t is string => Boolean(t))
  );

  // Collect types that had real mismatches (after filtering known-problems)
  const mismatchedTypes = new Set<string>();
  for (const m of mismatches) {
    const t = (m.actual && m.actual.type) || (m.expected && m.expected.type);

    if (typeof t === 'string') {
      mismatchedTypes.add(t);
    }
  }

  // Collect types that are marked as "knownProblem" in the golden snapshot
  const problematicTypesInGolden = new Set<string>();
  const collectKnownProblemTypes = (
    entries: readonly GoldenSnapshot[]
  ): void => {
    for (const e of entries) {
      if (e.knownProblem && e.type) {
        problematicTypesInGolden.add(e.type);
      }
      if (e.children && e.children.length > 0) {
        collectKnownProblemTypes(e.children);
      }
    }
  };
  collectKnownProblemTypes(goldenSnapshot);

  // Collect "Successful" types = covered by NatVis AND not mismatching AND
  // not flagged as knownProblem in the golden.
  const successfulTypes = [...allCoveredTypes]
    .filter((t) => !mismatchedTypes.has(t) && !problematicTypesInGolden.has(t))
    .sort((a, b) => a.localeCompare(b));

  // ---------------------------------------------------------------------------
  // Pretty printing of the summary
  // ---------------------------------------------------------------------------
  let natvisFileLabel: string = natvisPath ?? '<unknown>';

  if (natvisPath) {
    try {
      const rel = path.relative(wsFolder.uri.fsPath, natvisPath);
      // Normalize to forward slashes for clean display
      natvisFileLabel = rel.replace(/\\/g, '/');
    } catch {
      // Fallback to raw natvisPath if path.relative fails
      natvisFileLabel = natvisPath;
    }
  }
  // Print all covered and successful types
  console.log(
    `[natvis.summary] Tested Qt types successfully covered by NatVis file ${natvisFileLabel} on ${process.platform}:`
  );

  if (successfulTypes.length === 0) {
    console.log('  (none)');
  } else {
    for (const t of successfulTypes) {
      console.log(`  ${t}`);
    }
  }

  // Print Known-problem NatVis types (as marked in the golden snapshot)
  if (problematicTypesInGolden.size > 0) {
    console.log(
      `[natvis.summary] Tested Qt types with unsuccessful NatVis coverage on ${process.platform} (marked as knownProblem in the golden snapshot):`
    );
    for (const t of [...problematicTypesInGolden].sort()) {
      console.log(`  ${t}`);
    }
  } else {
    console.log(
      `[natvis.summary] No golden entries are marked with knownProblem on ${process.platform}.`
    );
  }

  // Print types with defined NatVis patterns but not exercised by this test
  const missingLines = missing.map((base) => {
    const alts = natvis.alts.get(base);
    return alts && alts.size ? `${base} (alts: ${[...alts].join(', ')})` : base;
  });

  if (missingLines.length > 0) {
    console.log(
      '[natvis.summary] Qt types defined in NatVis file but not covered by this test snapshot:'
    );
    for (const line of missingLines) {
      console.log(`  ${line}`);
    }
  } else {
    console.log(
      '[natvis.summary] All NatVis type patterns in this file were exercised by the current snapshot.'
    );
  }
}

export interface SnapshotMismatch {
  readonly name: string;
  readonly actual?: Snapshot;
  readonly expected?: GoldenSnapshot;
}

/**
 * Compare a runtime NatVis snapshot (`actual`) against the platform-resolved
 * golden snapshot (`expected`) and return *only the real mismatches*.
 *
 * This function performs a **name-based bidirectional comparison**:
 *
 *   1) **Pass 1 — iterate ACTUAL locals**
 *      - For each variable that appears in Locals:
 *          • If no golden entry exists → report as an extra unexpected variable.
 *          • If type and value both match → OK.
 *          • If they differ:
 *                – If the golden entry has `knownProblem`: mismatch is ignored
 *                  but logged in debug mode.
 *                – Otherwise → report as a real mismatch.
 *      - Additionally, if a golden entry had a knownProblem but now *matches*
 *        exactly, emit a “[good-news]” message in debug mode.
 *
 *   2) **Pass 2 — iterate GOLDEN entries**
 *      - For each expected variable missing in Locals:
 *          • If it has `knownProblem`: missing is ignored (optionally logged).
 *          • Otherwise → report as a real mismatch.
 *
 *   3) **Return value**
 *      - A list of `SnapshotMismatch` describing only the real failures:
 *          • missing expected entries,
 *          • extra unexpected entries,
 *          • mismatched entries not covered by known-problem exemptions.
 *
 * Design goals:
 *   - Per-variable known-problem handling resides *inside the golden snapshot*,
 *     not in a global table.
 *   - Full control over name/type/value comparison.
 *   - No index-based comparisons (stable under reordering).
 *   - Clear debug output: good-news logs, known-problem logs, real mismatches.
 *
 * @param actual   The platform-normalized locals emitted by the debugger.
 * @param expected The materialized golden snapshot for this platform.
 * @returns        Array of real mismatches (empty array → test passes).
 */
export function findMismatchedSnapshotEntries(
  actual: readonly Snapshot[],
  expected: readonly GoldenSnapshot[]
): SnapshotMismatch[] {
  const mismatches: SnapshotMismatch[] = [];

  // Build lookup maps by fully-qualified variable name
  const actualByName = new Map<string, Snapshot>();
  for (const a of actual) {
    if (!a.name) {
      continue;
    }
    actualByName.set(a.name, a);
  }

  const expectedByName = new Map<string, GoldenSnapshot>();
  for (const e of expected) {
    if (!e.name) {
      continue;
    }
    expectedByName.set(e.name, e);
  }

  const seenNames = new Set<string>();

  // ---------------------------------------------------------
  // Pass 1: walk ACTUAL locals, compare against golden
  // ---------------------------------------------------------
  for (const [name, a] of actualByName) {
    seenNames.add(name);

    const e = expectedByName.get(name);
    if (!e) {
      // Extra variable in Locals (not described by golden)
      mismatches.push({ name, actual: a });
      continue;
    }

    const sameType = a.type === e.type;
    const sameValue = a.value === e.value;

    if (sameType && sameValue) {
      if (e.knownProblem && process.env.QT_TEST_DEBUG === '1') {
        console.warn(
          `[natvis.test][good-news] Known problem for '${e.type ?? '<unknown>'}' ` +
            `(${name}) no longer mismatches on ${process.platform}.\n` +
            `  Previous description: ${e.knownProblem}`
        );
      }
      continue;
    }

    // Per-entry known problem on the golden side:
    // mismatch is *expected* and does not fail the test.
    if (e.knownProblem) {
      if (process.env.QT_TEST_DEBUG === '1') {
        console.warn(
          `[natvis.test][known-problem] '${name}' mismatch ignored.\n` +
            `  Reason: ${e.knownProblem}\n` +
            `  expected: ${JSON.stringify({ type: e.type, value: formatValuePreview(e.value) })}\n` +
            `  actual:   ${JSON.stringify({ type: a.type, value: formatValuePreview(a.value) })}`
        );
      }
      continue;
    }

    // Real mismatch
    mismatches.push({ name, actual: a, expected: e });
  }

  // ---------------------------------------------------------
  // Pass 2: walk GOLDEN entries, ensure none are missing in locals
  // ---------------------------------------------------------
  for (const [name, e] of expectedByName) {
    if (seenNames.has(name)) {
      continue;
    }

    // Golden expects a variable that does not exist in Locals
    if (e.knownProblem) {
      // Missing-but-known-broken: do not fail, only verbose in debug mode
      if (process.env.QT_TEST_DEBUG === '1') {
        console.warn(
          `[natvis.test][known-problem] '${name}' missing in Locals, ignoring.\n` +
            `  Reason: ${e.knownProblem}`
        );
      }
      continue;
    }

    mismatches.push({ name, expected: e });
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

      const goldenSnapshot = materializeGoldenSnapshot(
        GOLDEN_ENTRIES,
        process.platform
      );

      if (!goldenSnapshot) {
        throw new Error(
          `Golden not found. To create it run:\n  npm run natvis:golden:update`
        );
      }

      const mismatches = findMismatchedSnapshotEntries(
        natvisSnapshot,
        goldenSnapshot
      );

      // ---- NatVis summary: which types worked, which NatVis types are unused ----
      const SHOW_SUMMARY = process.env.NATVIS_SHOW_SUMMARY === '1';

      if (SHOW_SUMMARY) {
        printNatvisSummary({
          natvisSnapshot,
          goldenSnapshot,
          mismatches,
          natvis,
          missing,
          natvisPath,
          wsFolder
        });
      }
      // ---- Final assertion: fail if any real mismatches remain ----
      if (mismatches.length > 0) {
        const MAX_VALUE_PREVIEW = 200;

        const compactActual = mismatches.map((m) => ({
          name: m.name,
          type: m.actual?.type ?? m.expected?.type ?? '<unknown>',
          value: formatValuePreview(m.actual?.value)
        }));

        const compactExpected = mismatches.map((m) => ({
          name: m.name,
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

// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as path from 'path';

import { NatvisTypes, Snapshot, GoldenSnapshot } from './debug-golden.mts';

/**
 * NatVis test utilities for qt-cpp integration tests.
 *
 * This module contains small, test-focused helpers used by natvis.test.mts:
 * - Formatting helpers for readable mismatch diagnostics.
 * - A NatVis summary printer (coverage and known-problem reporting) for logs.
 * - A name-based, bidirectional snapshot comparer that supports per-entry
 *   known-problem exemptions embedded in the golden snapshot.
 *
 * These helpers are intentionally test-oriented (console output, diagnostics,
 * and strict comparisons) and are not meant for production code paths.
 */

/**
 * Returns a short, human-readable preview of any debugger value.
 * - Strings are kept as-is (truncated if long).
 * - Non-strings are JSON-stringified.
 * - Undefined becomes the literal "undefined".
 * - Long values are truncated with an indicator.
 */
export function formatValuePreview(v: unknown, max: number = 200): string {
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

/**
 * Describes a single *real* mismatch between a runtime NatVis snapshot
 * and the expected golden snapshot.
 *
 * A mismatch can represent one of three situations:
 *   - An **extra variable** present in Locals but not described by the golden
 *     snapshot (`actual` defined, `expected` undefined).
 *   - A **missing variable** expected by the golden snapshot but absent
 *     from Locals (`expected` defined, `actual` undefined).
 *   - A **value or type difference** for a variable present in both snapshots
 *     (`actual` and `expected` both defined but not equal).
 *
 * Entries covered by a `knownProblem` in the golden snapshot are filtered out
 * before this structure is produced; therefore, every `SnapshotMismatch`
 * represents a genuine test failure that should be surfaced to the user.
 */
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

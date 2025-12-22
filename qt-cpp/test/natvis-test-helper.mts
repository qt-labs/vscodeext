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
 * Compares a debugger snapshot against a platform-resolved golden snapshot and
 * returns the list of real NatVis mismatches.
 *
 * Matching is done by variable name (exact match). The comparison proceeds in
 * two passes:
 *
 * 1) Walk actual debugger locals:
 *    - If a variable is not described by the golden snapshot, it is reported as
 *      an extra entry.
 *    - If the variable exists in the golden snapshot:
 *        - Its type is first checked for semantic compatibility using NatVis
 *          information (base types and AlternativeType rules).
 *          Incompatible types indicate a real error (wrong variable or unsupported
 *          NatVis rule) and cause an immediate test failure.
 *        - If types are compatible, values are compared.
 *        - Value mismatches are ignored when the golden entry is marked as a
 *          platform-specific knownProblem.
 *        - Otherwise, value mismatches are collected.
 *
 * 2) Walk golden entries:
 *    - Any golden entry missing from the debugger locals is reported as a mismatch,
 *      unless it is marked as a knownProblem for the current platform.
 *
 * Notes:
 * - Type strings are not compared for exact equality, as they are debugger-dependent
 *   and not dictated by NatVis. Instead, a relaxed semantic compatibility check is
 *   used as a guardrail.
 * - Known problems are used only to suppress expected NatVis failures; they never
 *   suppress type incompatibility errors.
 *
 * @param actual   Platform-normalized debugger snapshot.
 * @param expected Platform-resolved golden snapshot (with knownProblem applied).
 * @param natvis   Parsed NatVis type information (bases and AlternativeType rules).
 * @returns        List of real mismatches to be asserted by the test.
 */
export function findMismatchedSnapshotEntries(
  actual: readonly Snapshot[],
  expected: readonly GoldenSnapshot[],
  natvis: NatvisTypes
): SnapshotMismatch[] {
  const mismatches: SnapshotMismatch[] = [];

  // Build lookup maps by variable name (exact match)
  const actualByName = new Map<string, Snapshot>();
  for (const a of actual) {
    if (!a.name) continue;

    const k = a.name;
    // Keep first occurrence deterministically; warn in debug if we collide
    if (!actualByName.has(k)) {
      actualByName.set(k, a);
    } else if (process.env.QT_TEST_DEBUG === '1') {
      const prev = actualByName.get(k)!;
      if (prev.name !== a.name) {
        console.warn(
          `[natvis.test][debug] actual key collision for '${k}': '${prev.name}' vs '${a.name}'`
        );
      }
    }
  }

  const expectedByName = new Map<string, GoldenSnapshot>();
  for (const e of expected) {
    if (!e.name) continue;

    const k = e.name;
    if (!expectedByName.has(k)) {
      expectedByName.set(k, e);
    } else if (process.env.QT_TEST_DEBUG === '1') {
      const prev = expectedByName.get(k)!;
      if (prev.name !== e.name) {
        console.warn(
          `[natvis.test][debug] expected key collision for '${k}': '${prev.name}' vs '${e.name}'`
        );
      }
    }
  }

  const seenKeys = new Set<string>();

  // Pass 1: walk ACTUAL locals, compare against golden
  for (const [k, a] of actualByName) {
    seenKeys.add(k);

    const e = expectedByName.get(k);
    if (!e) {
      // Extra variable in Locals (not described by golden)
      mismatches.push({ name: a.name, actual: a });
      continue;
    }

    const typesCompatible = areTypesCompatible(a.type, e.type, natvis);

    if (!typesCompatible) {
      throw new Error(
        `[natvis.test] Type incompatibility for '${e.name}' on ${process.platform}.\n` +
          `  expected type: ${e.type ?? '<none>'}\n` +
          `  actual type:   ${a.type ?? '<none>'}\n` +
          `This indicates a real mismatch (wrong variable or unsupported NatVis rule).`
      );
    }
    const sameValue = a.value === e.value;
    if (sameValue) {
      if (e.knownProblem && process.env.QT_TEST_DEBUG === '1') {
        console.warn(
          `[natvis.test][good-news] Known problem for '${e.type ?? '<unknown>'}' ` +
            `(${e.name}) no longer mismatches on ${process.platform}.\n` +
            `  Previous description: ${e.knownProblem}`
        );
      }
      continue;
    }

    if (e.knownProblem) {
      if (process.env.QT_TEST_DEBUG === '1') {
        console.warn(
          `[natvis.test][known-problem] '${e.name}' mismatch ignored.\n` +
            `  Reason: ${e.knownProblem}\n` +
            `  expected: ${JSON.stringify({ type: e.type, value: formatValuePreview(e.value) })}\n` +
            `  actual:   ${JSON.stringify({ type: a.type, value: formatValuePreview(a.value) })}`
        );
      }
      continue;
    }

    mismatches.push({ name: e.name, actual: a, expected: e });
  }

  // Pass 2: walk GOLDEN entries, ensure none are missing in locals
  for (const [k, e] of expectedByName) {
    if (seenKeys.has(k)) continue;

    if (e.knownProblem) {
      if (process.env.QT_TEST_DEBUG === '1') {
        console.warn(
          `[natvis.test][known-problem] '${e.name}' missing in Locals, ignoring.\n` +
            `  Reason: ${e.knownProblem}`
        );
      }
      continue;
    }

    mismatches.push({ name: e.name, expected: e });
  }

  return mismatches;
}

function normalizeType(typeText: string): string {
  return typeText
    .replace(/\b(class|struct|enum)\s+/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([<>,*&])\s*/g, '$1')
    .trim();
}

// Split only the outermost template.
// argsText is the exact text inside the outer <...> after normalization.
// arity counts outer args at depth 0.
function splitOuterTemplate(typeText: string): {
  base: string;
  argsText: string | undefined;
  arity: number;
} {
  const lt = typeText.indexOf('<');
  if (lt < 0) return { base: typeText.trim(), argsText: undefined, arity: 0 };

  const base = typeText.slice(0, lt).trim();

  let depth = 0;
  let gt = -1;
  for (let i = lt; i < typeText.length; i++) {
    const ch = typeText[i]!;
    if (ch === '<') depth++;
    else if (ch === '>') {
      depth--;
      if (depth === 0) {
        gt = i;
        break;
      }
    }
  }
  if (gt < 0)
    return { base, argsText: typeText.slice(lt + 1).trim(), arity: 0 };

  const inside = typeText.slice(lt + 1, gt);
  const argsText = inside.trim();

  // arity at depth 0
  depth = 0;
  let commas = 0;
  let hasNonWs = false;
  for (let i = 0; i < inside.length; i++) {
    const ch = inside[i]!;
    if (!/\s/.test(ch)) hasNonWs = true;
    if (ch === '<') depth++;
    else if (ch === '>') depth--;
    else if (ch === ',' && depth === 0) commas++;
  }
  const arity = hasNonWs ? commas + 1 : 1;

  return { base, argsText, arity };
}

function wildcard(base: string, arity: number): string {
  if (arity <= 0) return base;
  if (arity === 1) return `${base}<*>`;
  return `${base}<${Array(arity).fill('*').join(',')}>`;
}

// Accept debugger-expanded templates (extra args beyond what golden asserts).
// expected: QSpan<int>
// actual:   QSpan<int,184467...>
function expandedTemplateCompatible(expected: string, actual: string): boolean {
  if (expected === actual) return true;
  if (!expected.endsWith('>')) return false;

  const expectedNoClose = expected.slice(0, -1);
  if (!actual.startsWith(expectedNoClose)) return false;

  const next = actual[expectedNoClose.length];
  return next === '>' || next === ',' || next === ' ';
}

// Canonicalize a base type using NatVis equivalence information.
// We try:
// 1) base itself (handles AlternativeType entries that are non-templates),
// 2) base<wildcard> family (handles patterns like QList<*> having AlternativeType QVector<*>),
// 3) if NatVis defines base<wildcard>, use that as a stable family key,
// 4) otherwise keep the base.
function canonicalBase(
  base: string,
  arity: number,
  natvis: NatvisTypes
): string {
  const direct = natvis.altToBase.get(base);
  if (direct) return direct;

  const w = wildcard(base, arity);
  const wMapped = natvis.altToBase.get(w);
  if (wMapped) return wMapped;

  if (natvis.bases.has(w) || natvis.all.has(w)) return w;

  return base;
}

export function areTypesCompatible(
  actualType: string | undefined,
  expectedType: string | undefined,
  natvis: NatvisTypes
): boolean {
  if (!expectedType) return true;
  if (!actualType) return false;

  const a0 = normalizeType(actualType);
  const e0 = normalizeType(expectedType);

  if (a0 === e0) return true;

  // Handle QSpan<int> vs QSpan<int,...> before any other reasoning.
  if (expandedTemplateCompatible(e0, a0)) return true;

  const a = splitOuterTemplate(a0);
  const e = splitOuterTemplate(e0);

  if (a.argsText === undefined && e.argsText === undefined) {
    const aBase = canonicalBase(a.base, 0, natvis);
    const eBase = canonicalBase(e.base, 0, natvis);
    return aBase === eBase;
  }
  // If both have outer args and the args text matches, only compare base equivalence.
  if (
    a.argsText !== undefined &&
    e.argsText !== undefined &&
    a.argsText === e.argsText
  ) {
    const aBase = canonicalBase(a.base, a.arity, natvis);
    const eBase = canonicalBase(e.base, e.arity, natvis);
    return aBase === eBase;
  }

  // If debugger collapsed Type<A> to Type, accept if bases are equivalent.
  if (a.argsText === undefined && e.argsText !== undefined) {
    const aBase = canonicalBase(a.base, e.arity, natvis);
    const eBase = canonicalBase(e.base, e.arity, natvis);
    return aBase === eBase;
  }
  if (e.argsText === undefined && a.argsText !== undefined) {
    const aBase = canonicalBase(a.base, a.arity, natvis);
    const eBase = canonicalBase(e.base, a.arity, natvis);
    return aBase === eBase;
  }

  // Otherwise, do not treat differing template args as compatible.
  // Example: QList<int> vs QList<QString> should be incompatible.
  return false;
}

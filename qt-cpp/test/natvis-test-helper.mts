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
 * Print NatVis base `<Type Name="...">` patterns that were *not exercised* by the
 * current debugger snapshot.
 *
 * This function is part of the NatVis **coverage reporting** logic. It answers the
 * question:
 *
 *   “Which NatVis rules exist in the .natvis file but were not exercised by any
 *    variable in this test run?”
 *
 * How it works:
 * - Starts from `natvis.bases`, i.e. all `<Type Name="...">` entries declared
 *   in the NatVis file.
 * - Removes any bases listed in `natvis.skipCoverageBases`:
 *     • These represent internal / helper / private types that are expected
 *       to be exercised *indirectly* by public-facing Qt types.
 *     • Skipped bases are *not* considered missing coverage.
 * - Removes any bases that appear in `coveredNatvisFamilies`, which represents
 *   the NatVis “family keys” derived from actual debugger variables.
 *
 * Output:
 * - If uncovered bases remain, prints a list under:
 *     “[natvis.summary] Qt types defined in NatVis file but not covered…”
 * - Otherwise prints a success message indicating full coverage.
 *
 * Verbose diagnostics:
 * - When `NATVIS_VERBOSE=1` is set, this function also prints the list of
 *   skipped coverage bases along with their human-readable reasons
 *   (`natvis.skipCoverageReasons`), to make coverage decisions explicit
 *   and auditable in logs.
 *
 * Notes:
 * - This function is **purely diagnostic**; it does not affect test pass/fail.
 * - Coverage is evaluated at the NatVis *base type* level, not per concrete
 *   template instantiation.
 * - This intentionally avoids wildcard matching against concrete snapshot
 *   types; grouping is handled upstream via NatVis family computation.
 */
export function printUncoveredNatvisBases(params: {
  natvis: NatvisTypes;
  coveredNatvisFamilies: ReadonlySet<string>;
}): void {
  const { natvis, coveredNatvisFamilies } = params;

  const skip = natvis.skipCoverageBases ?? new Set<string>();

  const uncoveredBases = [...natvis.bases]
    .filter((base) => !skip.has(base))
    .filter((base) => !coveredNatvisFamilies.has(base))
    .sort((a, b) => a.localeCompare(b));

  const uncoveredLines = uncoveredBases.map((base) => {
    const alts = natvis.alts.get(base);
    return alts && alts.size ? `${base} (alts: ${[...alts].join(', ')})` : base;
  });

  if (process.env.NATVIS_VERBOSE === '1') {
    const reasons = natvis.skipCoverageReasons;
    if (reasons && reasons.size) {
      for (const base of skip) {
        const reason = reasons.get(base);
        if (reason) {
          console.log(`[natvis.summary][skip-coverage] ${base}: ${reason}`);
        }
      }
    }
  }

  if (uncoveredLines.length > 0) {
    console.log(
      '[natvis.summary] Qt types defined in NatVis file but not covered by this test snapshot:'
    );
    for (const lineText of uncoveredLines) {
      console.log(`  ${lineText}`);
    }
  } else {
    console.log(
      '[natvis.summary] All NatVis type patterns in this file were exercised by the current snapshot.'
    );
  }
}

/**
 * Print a human-readable NatVis summary to the test log.
 *
 * This function is purely diagnostic: it does not affect test pass/fail.
 *
 * It prints:
 *  - The NatVis file label (workspace-relative if possible)
 *  - The NatVis status summary table (and the "uncovered NatVis base patterns" list),
 *    both produced by `printNatvisTypeStatusTable(...)`.
 */
export function printNatvisSummary(params: {
  natvisSnapshot: readonly Snapshot[];
  goldenSnapshot: readonly GoldenSnapshot[];
  mismatches: readonly SnapshotMismatch[];
  goodNewsNames: ReadonlySet<string>;
  natvis: NatvisTypes;
  natvisPath: string | undefined;
  wsFolder: vscode.WorkspaceFolder;
}): void {
  const {
    natvisSnapshot,
    goldenSnapshot,
    mismatches,
    goodNewsNames,
    natvis,
    natvisPath,
    wsFolder
  } = params;

  let natvisFileLabel: string = natvisPath ?? '<unknown>';
  if (natvisPath) {
    try {
      const rel = path.relative(wsFolder.uri.fsPath, natvisPath);
      natvisFileLabel = rel.replace(/\\/g, '/');
    } catch {
      natvisFileLabel = natvisPath;
    }
  }

  console.log(
    `[natvis.summary] Using NatVis file ${natvisFileLabel} on ${process.platform}`
  );

  printNatvisTypeStatusTable({
    natvisSnapshot,
    goldenSnapshot,
    mismatches,
    goodNewsNames,
    natvis
  });
}

/**
 * Status of a NatVis table entry at a given validation level.
 *
 * Meanings:
 *   - 'OK'   : Variable value matches the golden snapshot and is not marked
 *              as a knownProblem.
 *   - 'KP'   : Validation is disabled because the golden entry is marked
 *              as knownProblem on this platform.
 *   - 'FAIL' : A real mismatch detected after knownProblem filtering
 *              (value mismatch, extra variable, or missing expected variable).
 *   - '-'    : Not evaluated yet (reserved for future use, e.g. child/Expand checks).
 */
type TypeStatus = 'OK' | 'KP' | 'FAIL' | '-';

/**
 * Sorting mode for the NatVis status summary table.
 *
 *   - 'status'          : Sort rows strictly by status severity (OK → KP → FAIL → '-'),
 *                         then by NatVis type and variable name.
 *   - 'status_grouped'  : Group rows by NatVis type, ordered by the *best*
 *                         status seen for that NatVis type, then sort within
 *                         each group by variable status and name.
 */
type SortMode = 'status' | 'status_grouped';

/**
 * Minimal shape of a row in the NatVis status summary table.
 *
 * This is the common interface used by sorting and grouping helpers.
 * Each row represents one top-level debugger variable.
 */
type NatvisTableRowLike = {
  /** Canonical NatVis family (e.g. QList<*>, QCborValue) */
  natvisType: string;
  /** Concrete C++ type reported by the debugger (e.g. QList<int>) */
  exercisedType: string;
  /** Fully qualified variable name in the debugger snapshot */
  varName: string;
  /** Root-level validation status for this variable */
  root: TypeStatus;
};

/**
 * Numeric ordering for TypeStatus values.
 *
 * Lower numbers are "better" and sort first.
 * Used to:
 *   - Order rows by severity.
 *   - Compute the best (least severe) root status for a NatVis type group.
 */
const STATUS_ORDER: Readonly<Record<TypeStatus, number>> = {
  OK: 0,
  KP: 1,
  FAIL: 2,
  '-': 3
};

/**
 * Resolve the NatVis summary table sort mode from the environment.
 *
 * Controlled via the NATVIS_TABLE_SORT environment variable.
 *
 * Supported values:
 *   - 'status'          : Sort rows strictly by status severity.
 *   - 'status_grouped'  : Group rows by NatVis type and order groups by their
 *                         best (least severe) status.
 *
 * Any unset or invalid value defaults to 'status_grouped', which provides
 * a more compact and NatVis-centric view.
 */
function getNatvisTableSortMode(): SortMode {
  const raw = (process.env.NATVIS_TABLE_SORT ?? '').trim().toLowerCase();
  return raw === 'status' || raw === 'status_grouped' ? raw : 'status_grouped';
}

/**
 * Compute the best (least severe) root status observed for each NatVis type.
 *
 * This helper is used by the 'status_grouped' sort mode to determine
 * the ordering of NatVis type groups.
 *
 * For each NatVis family (e.g. QList<*>), the smallest numeric rank
 * from STATUS_ORDER is kept:
 *   OK < KP < FAIL < '-'
 *
 * @param rows  Table rows representing individual variables.
 * @returns     Map from NatVis type to its best (lowest-severity) status rank.
 */
function buildBestStatusByNatvisType<T extends NatvisTableRowLike>(
  rows: readonly T[]
): ReadonlyMap<string, number> {
  const bestByNatvis = new Map<string, number>();

  for (const r of rows) {
    const rank = STATUS_ORDER[r.root];
    const prev = bestByNatvis.get(r.natvisType);

    if (prev === undefined || rank < prev) {
      bestByNatvis.set(r.natvisType, rank);
    }
  }

  return bestByNatvis;
}

/**
 * Sort NatVis summary table rows according to the selected sort mode.
 *
 * Two sorting strategies are supported:
 *
 * 1) **'status'**
 *    - Sort rows directly by root status severity (OK < KP < FAIL < '-').
 *    - Tie-breakers:
 *        a) NatVis type (alphabetical)
 *        b) Variable name (alphabetical)
 *
 *    This mode emphasizes individual variable failures.
 *
 * 2) **'status_grouped'** (default)
 *    - Group rows by NatVis type (e.g. QList<*>).
 *    - Order NatVis type groups by their *best* (least severe) status
 *      observed across all variables in that group.
 *    - Within each group:
 *        a) Root status severity
 *        b) Variable name
 *
 *    This mode provides a compact, NatVis-centric overview where related
 *    concrete types stay visually grouped.
 *
 * @param rows  Mutable list of NatVis table rows to be sorted in place.
 */
function sortNatvisRows<T extends NatvisTableRowLike>(rows: T[]): void {
  const mode = getNatvisTableSortMode();

  if (mode === 'status') {
    rows.sort((a, b) => {
      const sa = STATUS_ORDER[a.root];
      const sb = STATUS_ORDER[b.root];
      if (sa !== sb) return sa - sb;

      const byNatvis = a.natvisType.localeCompare(b.natvisType);
      if (byNatvis !== 0) return byNatvis;

      return a.varName.localeCompare(b.varName);
    });
    return;
  }

  // mode === 'status_grouped'
  const bestByNatvis = buildBestStatusByNatvisType(rows);

  rows.sort((a, b) => {
    const ga = bestByNatvis.get(a.natvisType) ?? STATUS_ORDER['-'];
    const gb = bestByNatvis.get(b.natvisType) ?? STATUS_ORDER['-'];
    if (ga !== gb) return ga - gb;

    const byNatvis = a.natvisType.localeCompare(b.natvisType);
    if (byNatvis !== 0) return byNatvis;

    const sa = STATUS_ORDER[a.root];
    const sb = STATUS_ORDER[b.root];
    if (sa !== sb) return sa - sb;

    return a.varName.localeCompare(b.varName);
  });
}

/**
 * Compute the "NatVis family" key used to group concrete exercised types into
 * a single NatVis type bucket for the summary table.
 *
 * Examples:
 * - "QList<int>"      -> "QList<*>"
 * - "QList<QString>"  -> "QList<*>"
 * - "QStringList"     -> "QList<*>" (if NatVis declares it as an AlternativeType)
 * - "QByteArray"      -> "QByteArray" (non-template types stay as-is)
 *
 * The algorithm:
 * 1) Normalize the raw debugger type string (strip class/struct, normalize spaces).
 * 2) Split only the outermost template to get (base, arity).
 * 3) Canonicalize the base using NatVis AlternativeType relationships so that
 *    equivalent types share a stable bucket key.
 * 4) Prefer returning an *existing* NatVis base pattern when possible.
 * 5) Otherwise derive a wildcard pattern (e.g. base<*,*>), but only keep it if
 *    NatVis actually defines that pattern.
 * 6) Final fallback: return the base name.
 *
 * @param exercisedType  Concrete type string as reported by the debugger (may be noisy).
 * @param natvis         Parsed NatVis type metadata (base patterns and AlternativeType rules).
 * @returns              A stable grouping key used as the "NatVis Type" column in the table.
 */
function computeNatvisFamily(
  exercisedType: string,
  natvis: NatvisTypes
): string {
  const t = normalizeType(exercisedType);
  const parsed = splitOuterTemplate(t);
  const base = canonicalBase(parsed.base, parsed.arity, natvis);

  // If canonicalBase already returned a known NatVis base pattern, keep it.
  if (natvis.bases.has(base)) {
    return base;
  }

  // Otherwise, try a wildcard family derived from the concrete type.
  const w = wildcard(parsed.base, parsed.arity);
  if (natvis.bases.has(w) || natvis.all.has(w)) {
    return w;
  }

  // Fallback: show the base (still useful for non-template types).
  return parsed.base;
}

/**
 * Print a compact, per-variable NatVis status table to the test log.
 *
 * The table is intended as a quick “at a glance” overview of what the current
 * NatVis run produced, using variable names as the primary key (not types).
 *
 * Each row represents one top-level variable, and includes:
 *  - `natvisType`: the NatVis “family key” derived from the concrete type
 *    (e.g. QList<int> and QList<double> group under QList<*> when applicable).
 *  - `exercisedType`: the concrete debugger type for that variable (or "<none>").
 *  - `varName`: the variable name (matches how snapshots/golden are compared).
 *  - `root`: status of the top-level DisplayString value vs golden.
 *  - `children`: status of Expand children vs golden (not implemented yet, so "-").
 *
 * In addition to the table, this function also prints **uncovered NatVis base patterns**
 * (i.e. `<Type Name="...">` entries from the NatVis file that were not exercised by the
 * current snapshot). Uncovered patterns are derived from the same NatVis family keys
 * computed for table rows (via `computeNatvisFamily(...)`), and are printed via
 * `printUncoveredNatvisBases(...)`.
 *
 * Status semantics (root column):
 *  - OK:  variable exists in both snapshot and golden, is not knownProblem, and
 *         does not appear in the mismatch list.
 *  - KP:  golden marks this variable as knownProblem for the current platform
 *         (assertion disabled even if it mismatches).
 *  - KP*: same as KP, but the variable unexpectedly matched; the variable name
 *         is present in `goodNewsNames` (“progress” indicator).
 *  - FAIL: any real mismatch for this variable (after knownProblem filtering),
 *          including:
 *            • variable present in snapshot but missing from golden
 *            • variable missing from snapshot but present in golden (unless KP)
 *            • value mismatch with no knownProblem
 *
 * Row construction uses two passes:
 *  1) Iterate `natvisSnapshot` to report observed variables (including
 *     snapshot-only extras).
 *  2) Iterate `goldenSnapshot` to add golden-only variables missing from
 *     the snapshot (so missing expectations are visible as FAIL/KP).
 *
 * Sorting is delegated to `sortNatvisRows` and can be influenced via
 * NATVIS_TABLE_SORT ("status" or "status_grouped").
 *
 * @param params.natvisSnapshot Platform-normalized locals after NatVis filtering.
 * @param params.goldenSnapshot Platform-resolved golden snapshot (with knownProblem).
 * @param params.mismatches     Real mismatches returned by the comparison logic.
 * @param params.goodNewsNames  Variable names whose knownProblem entries matched (KP*).
 * @param params.natvis         Parsed NatVis type information (bases and AlternativeType rules).
 */
export function printNatvisTypeStatusTable(params: {
  natvisSnapshot: readonly Snapshot[];
  goldenSnapshot: readonly GoldenSnapshot[];
  mismatches: readonly SnapshotMismatch[];
  goodNewsNames: ReadonlySet<string>;
  natvis: NatvisTypes;
}): void {
  const { natvisSnapshot, goldenSnapshot, mismatches, goodNewsNames, natvis } =
    params;

  const failNames = new Set<string>(mismatches.map((m) => m.name));

  const goldenByName = new Map<string, GoldenSnapshot>();
  for (const g of goldenSnapshot) {
    goldenByName.set(g.name, g);
  }
  type Row = {
    natvisType: string;
    exercisedType: string;
    varName: string;
    root: TypeStatus;
    children: TypeStatus;
    kpGoodNews: boolean;
  };

  const rows: Row[] = [];

  const coveredNatvisFamilies = new Set<string>();

  for (const a of natvisSnapshot) {
    const varName = a.name;
    const exercisedType = a.type ?? '<none>';
    const natvisType = computeNatvisFamily(exercisedType, natvis);

    coveredNatvisFamilies.add(natvisType);

    const g = goldenByName.get(varName);

    let root: TypeStatus = 'OK';
    if (!g) {
      // Variable present in Locals but missing from golden => real failure
      root = 'FAIL';
    } else if (failNames.has(varName)) {
      root = 'FAIL';
    } else if (g.knownProblem) {
      root = 'KP';
    }

    const children: TypeStatus = '-';
    const kpGoodNews = root === 'KP' && goodNewsNames.has(varName);

    rows.push({
      natvisType,
      exercisedType,
      varName,
      root,
      children,
      kpGoodNews
    });
  }

  const seenNames = new Set<string>(natvisSnapshot.map((s) => s.name));

  for (const g of goldenSnapshot) {
    if (seenNames.has(g.name)) continue;

    const varName = g.name;
    const exercisedType = g.type ?? '<none>';
    const natvisType = computeNatvisFamily(exercisedType, natvis);

    let root: TypeStatus = 'OK';
    if (failNames.has(varName)) {
      root = 'FAIL';
    } else if (g.knownProblem) {
      root = 'KP';
    } else {
      // expected but missing and not knownProblem => FAIL is already in mismatches by name,
      // but keep this defensive:
      root = 'FAIL';
    }

    const children: TypeStatus = '-';
    const kpGoodNews = root === 'KP' && goodNewsNames.has(varName);

    rows.push({
      natvisType,
      exercisedType,
      varName,
      root,
      children,
      kpGoodNews
    });
  }
  sortNatvisRows(rows);
  const header = [
    'NatVis Type',
    'Exercised type',
    'Variable name',
    'Status root',
    'Status children'
  ];

  // Simple fixed-width formatting (good enough for logs)
  const colWidths = [0, 0, 0, 0, 0];
  const consider = (cols: string[]) => {
    for (let i = 0; i < cols.length; i++) {
      colWidths[i] = Math.max(colWidths[i]!, cols[i]!.length);
    }
  };

  consider(header);
  for (const r of rows) {
    const rootLabel = r.root === 'KP' && r.kpGoodNews ? 'KP*' : r.root;
    consider([r.natvisType, r.exercisedType, r.varName, rootLabel, r.children]);
  }

  printUncoveredNatvisBases({ natvis, coveredNatvisFamilies });

  const pad = (s: string, w: number) =>
    s + ' '.repeat(Math.max(0, w - s.length));
  const line = (cols: string[]) =>
    cols.map((c, i) => pad(c, colWidths[i]!)).join(' | ');
  console.log(
    `[natvis.summary] Qt Type natvis status summary (covered types only):`
  );
  console.log('  ' + line(header));
  console.log('  ' + colWidths.map((w) => '-'.repeat(w)).join('-|-'));
  for (const r of rows) {
    const rootLabel = r.root === 'KP' && r.kpGoodNews ? 'KP*' : r.root;
    console.log(
      '  ' +
        line([r.natvisType, r.exercisedType, r.varName, rootLabel, r.children])
    );
  }
  console.log('  ' + colWidths.map((w) => '-'.repeat(w)).join('-|-'));
  console.log(`  (covers variables from snapshot + golden expectations)`);
  console.log('  Columns:');
  console.log(
    '    root     = status of the top-level variable value vs golden'
  );
  console.log('    children = status of NatVis Expand children vs golden');
  console.log('              (not explored yet, so currently always "-")');
  console.log('  Status codes:');
  console.log('    OK   = matches golden and not marked knownProblem');
  console.log(
    '    KP   = assertion disabled due to knownProblem on this platform'
  );
  console.log('    FAIL = mismatches golden (after knownProblem filtering)');
  console.log('    -    = not explored');
  console.log('  ' + colWidths.map((w) => '-'.repeat(w)).join('---'));
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
 * @returns        Object containing:
 *                 - `mismatches`: list of real NatVis mismatches to be asserted by the test.
 *                 - `goodNewsNames`: set of Qt types variable whose `knownProblem` entries unexpectedly matched
 *                   (used for reporting progress, e.g. KP* in summaries).
 */
export function findMismatchedSnapshotEntries(
  actual: readonly Snapshot[],
  expected: readonly GoldenSnapshot[],
  natvis: NatvisTypes
): { mismatches: SnapshotMismatch[]; goodNewsNames: ReadonlySet<string> } {
  const goodNewsNames = new Set<string>();

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
      if (e.knownProblem) {
        goodNewsNames.add(e.name);
        console.warn(
          `[natvis.test][good-news] Known problem for '${e.type ?? '<unknown>'}' ` +
            `(${e.name}) no longer mismatches on ${process.platform}.\n` +
            `  Previous description: ${e.knownProblem}`
        );
      }
      continue;
    }

    if (e.knownProblem) {
      if (process.env.NATVIS_VERBOSE === '1') {
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

  return { mismatches, goodNewsNames };
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

  // Allow explicit aliases (typedef vs expanded template spelling, etc.).
  // Example: expected "CoreStateFlags" vs actual "QFlags<CoreStateFlag>" on win32.
  const expectedAliases = natvis.extraAliases?.get(e0);
  if (expectedAliases) {
    for (const alias of expectedAliases) {
      const aliasNorm = normalizeType(alias);

      if (aliasNorm === a0) return true;

      // Also allow expanded-template variants if the alias is the shorter form.
      if (expandedTemplateCompatible(aliasNorm, a0)) return true;
    }
  }

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

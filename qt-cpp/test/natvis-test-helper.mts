// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as path from 'path';

import {
  NatvisTypes,
  Snapshot,
  GoldenSnapshot,
  ValueByPlatform
} from './debug-golden.mts';

function indexByName<T extends { name: string }>(
  items: readonly T[] | undefined
): ReadonlyMap<string, T> {
  const m = new Map<string, T>();
  for (const it of items ?? []) {
    if (!m.has(it.name)) m.set(it.name, it);
  }
  return m;
}

function resolvesKnownProblem(
  kp: string | ValueByPlatform | undefined,
  platform: NodeJS.Platform
): string | undefined {
  if (!kp) return undefined;
  if (typeof kp === 'string') return kp;
  switch (platform) {
    case 'darwin':
      return kp.darwin ?? kp.all;
    case 'linux':
      return kp.linux ?? kp.all;
    case 'win32':
      return kp.win32 ?? kp.all;
    default:
      return kp.all;
  }
}

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
 *  - The NatVis file label (workspace-relative if possible).
 *  - The NatVis status summary table, derived entirely from `statsByRoot`
 *    (root/children slices) and the golden snapshot.
 *  - The list of NatVis base patterns that were not exercised in this run
 *    (coverage report).
 *
 * The summary reflects the already-computed comparison results:
 *  - Root and children statuses are read from `StatsByRoot`.
 *  - No additional assessment or mismatch logic is performed here.
 *
 * This function is a thin logging wrapper around
 * `printNatvisTypeStatusTable(...)`.
 */
export function printNatvisSummary(params: {
  goldenSnapshot: readonly GoldenSnapshot[];
  statsByRoot: StatsByRoot;
  natvis: NatvisTypes;
  natvisPath: string | undefined;
  wsFolder: vscode.WorkspaceFolder;
}): void {
  const { goldenSnapshot, statsByRoot, natvis, natvisPath, wsFolder } = params;

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
    goldenSnapshot,
    statsByRoot,
    natvis
  });
}

/**
 * Status of a NatVis table entry at a given validation level.
 *
 * Meanings:
 *   - 'OK'   : The slice was evaluated and fully matches the golden snapshot
 *              (no knownProblem involved).
 *   - 'KP'   : The golden entry is marked as knownProblem on this platform
 *              and validation is therefore suppressed.
 *   - 'KP*'  : The entry is marked as knownProblem, but it unexpectedly matches
 *              the golden value (good news).
 *   - 'FAIL' : A real mismatch was detected (after knownProblem filtering),
 *              including missing variables or value differences.
 *   - 'x'    : The slice could not be evaluated (unknown), typically because
 *              a root-level failure prevented reliable comparison.
 *   - '?'    : The slice was intentionally not evaluated (e.g. no golden
 *              children defined), so no success/failure/KP state applies.
 */
type TypeStatus = 'OK' | 'KP' | 'KP*' | 'FAIL' | 'x' | '?';

/**
 * Sorting mode for the NatVis status summary table.
 *
 *   - 'status'
 *       Sort rows strictly by root status severity
 *       (OK < KP* < KP < FAIL < x < ?),
 *       then by NatVis type and variable name.
 *
 *   - 'status_grouped'
 *       Group rows by NatVis type, ordered by the *best*
 *       (least severe) root status observed for that NatVis type.
 *       Within each group, rows are sorted by:
 *         1) root status severity
 *         2) variable name
 */
type SortMode = 'status' | 'status_grouped';

/**
 * Minimal shape of a row in the NatVis status summary table.
 *
 * This is the common interface used by sorting and grouping helpers.
 * Each row represents one top-level debugger variable.
 */
type NatvisTableRowLike = {
  /**
   * NatVis type label shown in the table.
   * This is typically resolved from the exercised debugger type
   * (if it matches a NatVis <Type Name="..."> entry),
   * otherwise it may fall back to the golden-declared type.
   */
  natvisType: string;

  /** Concrete C++ type reported by the debugger (from Locals). */
  exercisedType: string;

  /** Fully qualified variable name in the debugger snapshot. */
  varName: string;

  /** Root-level validation status for this variable. */
  root: TypeStatus;
};

/**
 * Numeric ordering for TypeStatus values.
 *
 * Lower numbers are "better" and sort first.
 *
 * Ordering semantics:
 *   OK   < KP* < KP < FAIL < x < ?
 *
 * Where:
 *   - OK   : fully validated and correct
 *   - KP*  : knownProblem exists but now matches (good news)
 *   - KP   : knownProblem (assertion disabled)
 *   - FAIL : real mismatch
 *   - x    : could not be evaluated (e.g. root-level failure prevented comparison)
 *   - ?    : unevaluated (nothing to compare, e.g. no golden children)
 *
 * Used to:
 *   - Order rows by severity.
 *   - Compute the best (least severe) root status for grouping.
 */
const STATUS_ORDER: Readonly<Record<TypeStatus, number>> = {
  OK: 0,
  'KP*': 1,
  KP: 2,
  FAIL: 3,
  x: 4,
  '?': 5
};

/**
 * Resolve the NatVis summary table sort mode from the environment.
 *
 * Controlled via the NATVIS_TABLE_SORT environment variable.
 *
 * Supported values:
 *   - 'status'
 *       Sort rows strictly by root status severity (OK < KP* < KP < FAIL < x < ?),
 *       then by NatVis type and variable name.
 *
 *   - 'status_grouped'
 *       Group rows by resolved NatVis type and order groups by the *best*
 *       (least severe) root status observed in that group.
 *       Within each group, rows are sorted by status and variable name.
 *
 * Any unset or invalid value defaults to 'status_grouped', which provides
 * a more compact, NatVis-centric overview.
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
 *
 *   OK < KP* < KP < FAIL < x < ?
 *
 * Only the *root* status is considered for grouping. Children status
 * does not affect group ordering.
 *
 * @param rows  Table rows representing individual variables.
 * @returns     Map from NatVis type to its best (lowest-severity) root status rank.
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
 *    - Sort rows directly by *root* status severity:
 *
 *        OK < KP* < KP < FAIL < x < ?
 *
 *    - Tie-breakers:
 *        a) NatVis type (alphabetical)
 *        b) Variable name (alphabetical)
 *
 *    This mode emphasizes individual variable failures.
 *
 * 2) **'status_grouped'** (default)
 *    - Group rows by NatVis type (e.g. QList<*>).
 *    - Order NatVis type groups by their *best* (least severe) root status
 *      observed across all variables in that group.
 *    - Within each group:
 *        a) Root status severity
 *        b) Variable name
 *
 *    This mode provides a compact, NatVis-centric overview where related
 *    concrete types stay visually grouped.
 *
 * Notes:
 * - Only the *root* status is used for sorting/grouping. Children status does not
 *   affect ordering.
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
    const ga = bestByNatvis.get(a.natvisType) ?? STATUS_ORDER['?'];
    const gb = bestByNatvis.get(b.natvisType) ?? STATUS_ORDER['?'];
    if (ga !== gb) return ga - gb;

    const byNatvis = a.natvisType.localeCompare(b.natvisType);
    if (byNatvis !== 0) return byNatvis;

    const sa = STATUS_ORDER[a.root];
    const sb = STATUS_ORDER[b.root];
    if (sa !== sb) return sa - sb;

    return a.varName.localeCompare(b.varName);
  });
}

function isWildcardTemplatePattern(typePattern: string): boolean {
  const parsed = splitOuterTemplate(typePattern);
  if (parsed.arity <= 0) return false;

  const args = (parsed.argsText ?? '').split(',').map((s) => s.trim());
  return args.length > 0 && args.every((a) => a === '*');
}

function parseArity(typePattern: string): { base: string; arity: number } {
  const p = splitOuterTemplate(typePattern);
  return { base: p.base, arity: p.arity };
}

/**
 * Compute the set of NatVis base `<Type Name="...">` patterns that should be
 * considered **covered** when the debugger reports a concrete exercised runtime type.
 *
 * Why this exists:
 * - A single concrete runtime type can satisfy multiple NatVis `<Type Name="...">` rules.
 *   Example: `QBasicAtomicPointer<void>` matches both:
 *     - `QBasicAtomicPointer<void>` (exact specialization)
 *     - `QBasicAtomicPointer<*>`    (generic wildcard family)
 * - Coverage must mark *all* matching NatVis bases as covered; otherwise an exact
 *   specialization may be reported as “missing” even though the runtime type exercised it.
 *
 * What this function returns:
 * - A set of NatVis base patterns (strings that exist in `natvis.bases`) that should be
 *   added to the “covered” set for coverage reporting.
 *
 * How it works:
 * 1) Normalize the exercised type spelling (`normalizeType`) and split the outer template
 *    (`splitOuterTemplate`) to get:
 *      - base name (e.g. QBasicAtomicPointer)
 *      - template arity (e.g. 1 for <T>, 2 for <K,V>, ...)
 * 2) Build a small set of candidate keys derived from the exercised type:
 *      - exact normalized type (covers specializations like `Type<void>`)
 *      - wildcard family for the same base/arity (e.g. `Type<*>`, `Type<*,*>`)
 *      - canonicalized base/family via AlternativeType / aliases (`canonicalBase`)
 * 3) Keep only candidates that correspond to real NatVis bases:
 *      - if candidate itself is in `natvis.bases`, include it
 *      - if candidate is an AlternativeType that maps via `natvis.altToBase`, include its base
 * 4) Additionally, include any wildcard NatVis base patterns that share the same *base name*
 *    as the exercised type and whose wildcard arity is less-or-equal to the exercised arity.
 *    This is done by scanning `natvis.bases` and selecting patterns like `Base<*>`, `Base<*,*>`, ...
 *
 * Notes:
 * - This is *coverage accounting only*. Table display should still pick a single best label
 *   (see `pickMostSpecificNatvisBase`) for readability.
 * - The wildcard scan is O(|natvis.bases|). That’s fine for NatVis sizes, but it is a deliberate
 *   choice (it is not just using the 2-3 direct candidate keys).
 */
function computeCoveredNatvisBasesForType(
  exercisedType: string,
  natvis: NatvisTypes
): ReadonlySet<string> {
  const t = normalizeType(exercisedType);
  const parsed = splitOuterTemplate(t);

  const keys = new Set<string>();

  // 1) Exact spelling (covers specializations like QBasicAtomicPointer<void>)
  keys.add(t);

  // 2) Wildcard family (covers patterns like QBasicAtomicPointer<*>)
  if (parsed.arity > 0) {
    keys.add(wildcard(parsed.base, parsed.arity));
  }

  // 3) Canonicalization via AlternativeType / aliases (helps typedef-style names)
  //    base-only canonicalization for non-templates
  keys.add(canonicalBase(parsed.base, parsed.arity, natvis));

  const out = new Set<string>();
  for (const k of keys) {
    if (natvis.bases.has(k)) {
      out.add(k);
    }
    const mapped = natvis.altToBase.get(k);
    if (mapped && natvis.bases.has(mapped)) {
      out.add(mapped);
    }
  }

  for (const basePattern of natvis.bases) {
    const p = parseArity(basePattern);
    if (p.base !== parsed.base) continue;
    if (!isWildcardTemplatePattern(basePattern)) continue;

    if (parsed.arity === 0 || parsed.arity >= p.arity) {
      out.add(basePattern);
    }
  }

  return out;
}

/**
 * Pick a single NatVis `<Type Name="...">` base pattern to *display* in the
 * NatVis status summary table when one exercised runtime type covers multiple
 * NatVis rules.
 *
 * Why this exists:
 * - A single concrete runtime type can match multiple NatVis `<Type>` patterns.
 *   Example: `QBasicAtomicPointer<void>` can match both:
 *     - `QBasicAtomicPointer<void>` (exact specialization)
 *     - `QBasicAtomicPointer<*>`    (wildcard family)
 * - Coverage accounting marks *all* matching NatVis bases as covered, but the
 *   summary table needs exactly one label per row for readability.
 *
 * Selection strategy (most specific wins):
 * - Prefer candidates that do not contain `*` (treat as “more specific”).
 * - If still tied, prefer the longer string as a stable tie-breaker.
 *
 * Fallback:
 * - If `candidates` is empty, fall back to `computeNatvisFamily(exercisedType, natvis)`
 *   to preserve older behavior.
 *
 * Notes:
 * - This function affects only table labeling, not coverage accounting.
 */
function pickMostSpecificNatvisBase(
  candidates: ReadonlySet<string>,
  exercisedType: string,
  natvis: NatvisTypes
): string {
  if (candidates.size === 0) {
    // Keep existing behavior as a fallback
    return computeNatvisFamily(exercisedType, natvis);
  }

  const scored = [...candidates].map((c) => {
    // Specificity rules:
    // - Prefer no wildcard '*'
    // - Prefer exact template spellings over wildcard family
    // - Prefer longer strings as a tie-breaker
    const hasStar = c.includes('*');
    const score = (hasStar ? 0 : 10) + c.length / 1000;
    return { c, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]!.c;
}

/**
 * Resolve the NatVis `<Type Name="...">` label to display in the summary table
 * for a given debugger variable.
 *
 * Strategy:
 * 1) Prefer a NatVis base pattern that actually matches the concrete
 *    `exercisedType` reported by the debugger.
 *    - Uses `computeCoveredNatvisBasesForType(...)` to determine all
 *      matching NatVis `<Type>` entries.
 *    - If one or more matches exist, selects the most specific one via
 *      `pickMostSpecificNatvisBase(...)`.
 *
 * 2) If the exercised type cannot be mapped to any NatVis `<Type>` entry,
 *    fall back to the `goldenType`, but only if that type exists in
 *    `natvis.bases`.
 *
 * 3) As a final fallback, return `goldenType` (or "<none>") so that the
 *    table remains readable even if neither locals nor golden type can
 *    be resolved to a known NatVis base.
 *
 * Notes:
 * - This function only affects how the "NatVis Type" column is displayed.
 * - It does not influence validation logic or coverage accounting.
 */
function resolveNatvisTypeForRow(params: {
  exercisedType: string;
  goldenType: string | undefined;
  natvis: NatvisTypes;
}): string {
  const { exercisedType, goldenType, natvis } = params;

  // 1) Try to find something that actually exists in the NatVis file from locals type
  const covered = computeCoveredNatvisBasesForType(exercisedType, natvis);
  if (covered.size > 0) {
    return pickMostSpecificNatvisBase(covered, exercisedType, natvis);
  }

  // 2) If locals type cannot be mapped to any natvis <Type Name="...">, use golden as fallback
  if (goldenType && natvis.bases.has(goldenType)) {
    return goldenType;
  }

  // 3) Last resort (keeps table readable even if both fail)
  return goldenType ?? '<none>';
}

/**
 * Compute a stable "NatVis family" key used to bucket concrete exercised types
 * for reporting and grouping when we cannot (or do not want to) pick a single
 * concrete NatVis `<Type Name="...">` base pattern.
 *
 * This is primarily a **fallback grouping key**. When possible, the summary table
 * should prefer displaying an actual NatVis base pattern resolved from the locals
 * type (see `resolveNatvisTypeForRow`), but this function remains useful to:
 * - keep grouping stable across template instantiations
 * - handle AlternativeType relationships
 * - provide a readable label when no exact NatVis base can be resolved
 *
 * Examples:
 * - "QList<int>"      -> "QList<*>"
 * - "QList<QString>"  -> "QList<*>"
 * - "QStringList"     -> "QList<*>" (if NatVis declares it as an AlternativeType)
 * - "QByteArray"      -> "QByteArray" (non-template types stay as-is)
 *
 * Algorithm:
 * 1) Normalize the raw debugger type string (strip class/struct, normalize spaces).
 * 2) Split only the outermost template to get (base, arity).
 * 3) Canonicalize the base using NatVis AlternativeType relationships so that
 *    equivalent types share a stable bucket key.
 * 4) If canonicalization yields an existing NatVis base pattern, return it.
 * 5) Otherwise derive a wildcard family (e.g. base<*,*>), but only keep it if
 *    NatVis defines that pattern.
 * 6) Final fallback: return the raw base name.
 *
 * @param exercisedType  Concrete type string as reported by the debugger (may be noisy).
 * @param natvis         Parsed NatVis type metadata (bases and AlternativeType rules).
 * @returns              A stable family key suitable for grouping/reporting.
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
 * Convert a StatSlice into a table-level TypeStatus.
 *
 * Mapping rules (priority order):
 *
 *  - 'x'    : slice.unknown === true
 *             The node could not be evaluated at all
 *             (typically due to a root-level failure preventing children evaluation).
 *
 *  - 'OK'   : slice.succeeded === true
 *             Value (or children block) matched the golden snapshot
 *             and is not marked as a knownProblem.
 *
 *  - 'FAIL' : slice.failed === true
 *             A real mismatch was detected after knownProblem filtering.
 *
 *  - 'KP*'  : slice.hadKP === true && slice.kpGoodNews === true
 *             A knownProblem exists for this platform, but the comparison
 *             unexpectedly succeeded ("good news").
 *
 *  - 'KP'   : slice.hadKP === true
 *             Validation is disabled due to a knownProblem on this platform.
 *
 *  - '?'    : Fallback state.
 *             The slice was evaluated (unknown === false), but no success,
 *             failure, or knownProblem was recorded.
 *             For children, this typically means there were no golden
 *             children to compare or that the root has a KP.
 *
 * NOTE:
 * - 'unknown' maps exclusively to 'x'.
 * - '?' does NOT mean unknown; it means "evaluated but nothing asserted".
 */
function statusFromSlice(slice: StatSlice): TypeStatus {
  if (slice.unknown) return 'x';
  if (slice.succeeded) return 'OK';
  if (slice.failed) return 'FAIL';
  if (slice.hadKP) return slice.kpGoodNews ? 'KP*' : 'KP';
  return '?';
}

/**
 * Print a compact, per-variable NatVis status table to the test log.
 *
 * The table is an at-a-glance summary keyed by **top-level variable name**.
 * Each row corresponds to one root variable that appears either:
 * - in the golden snapshot (expected), or
 * - in the locals snapshot only (extra).
 *
 * Row columns:
 *  - natvisType      : The NatVis `<Type Name="...">` pattern chosen for display
 *                      for this variable (prefers the most specific matching rule).
 *  - exercisedType   : The concrete runtime type reported by the debugger.
 *  - variable name   : The fully qualified root variable name.
 *  - status root     : Result of comparing the root value against the golden entry.
 *  - status children : Result of comparing children (Expand) against the golden entry.
 *
 * Status computation is entirely derived from `statsByRoot` via `statusFromSlice(...)`.
 * In particular:
 *  - 'x' means the children could not be evaluated due to a root-level problem.
 *  - '?' means the children slice was evaluated but nothing was asserted
 *    (most commonly: there are no golden children for this variable yet).
 *
 * Coverage reporting:
 * - While building rows, the function also tracks which NatVis base patterns were
 *   exercised by the concrete types seen in the table. It then prints the set of
 *   NatVis bases that remain uncovered via `printUncoveredNatvisBases(...)`.
 *
 * Sorting:
 * - Rows are sorted by `sortNatvisRows(...)`, controlled by `NATVIS_TABLE_SORT`
 *   ("status" or "status_grouped").
 *
 * This function is diagnostic only (log output). It does not determine pass/fail.
 */
export function printNatvisTypeStatusTable(params: {
  goldenSnapshot: readonly GoldenSnapshot[];
  statsByRoot: StatsByRoot;
  natvis: NatvisTypes;
}): void {
  const { goldenSnapshot, statsByRoot, natvis } = params;

  const goldenByName = new Map<string, GoldenSnapshot>();
  for (const g of goldenSnapshot) goldenByName.set(g.name, g);

  type Row = {
    natvisType: string;
    exercisedType: string;
    varName: string;
    root: TypeStatus;
    children: TypeStatus;
  };

  const rows: Row[] = [];
  const coveredNatvisFamilies = new Set<string>();

  for (const [varName, rowStats] of statsByRoot) {
    const g = goldenByName.get(varName);

    const exercisedType = rowStats.exercisedType ?? '<none>';

    const coveredBasesForVar = computeCoveredNatvisBasesForType(
      exercisedType,
      natvis
    );
    for (const b of coveredBasesForVar) coveredNatvisFamilies.add(b);

    const natvisType = resolveNatvisTypeForRow({
      exercisedType,
      goldenType: g?.type,
      natvis
    });

    const root = statusFromSlice(rowStats.stats.root);

    const children = statusFromSlice(rowStats.stats.children);

    rows.push({ natvisType, exercisedType, varName, root, children });
  }

  sortNatvisRows(rows);

  // ---- formatting + printing stays mostly identical ----
  // BUT: remove kpGoodNewsRoot/kpGoodNewsChildren and the label rewriting
  // because statusFromSlice already returns KP*.

  const header = [
    'NatVis Type',
    'Exercised type',
    'Variable name',
    'Status root',
    'Status children'
  ];

  const colWidths = [0, 0, 0, 0, 0];
  const consider = (cols: string[]) => {
    for (let i = 0; i < cols.length; i++) {
      colWidths[i] = Math.max(colWidths[i]!, cols[i]!.length);
    }
  };

  consider(header);
  for (const r of rows) {
    consider([r.natvisType, r.exercisedType, r.varName, r.root, r.children]);
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
    console.log(
      '  ' +
        line([r.natvisType, r.exercisedType, r.varName, r.root, r.children])
    );
  }
  console.log('  ' + colWidths.map((w) => '-'.repeat(w)).join('-|-'));
  console.log('  (covers variables from snapshot + golden expectations)');
  console.log('  Columns:');
  console.log(
    '    root     = status of the top-level variable value vs golden'
  );
  console.log('    children = status of NatVis Expand children vs golden');
  console.log('  Status codes:');
  console.log('    OK   = matches golden and not marked knownProblem');
  console.log(
    '    KP   = assertion disabled due to knownProblem on this platform'
  );
  console.log('    KP*  = knownProblem exists but now matches (good news)');
  console.log('    FAIL = mismatches golden (after knownProblem filtering)');
  console.log('    x    = could not be evaluated');
  console.log(
    '    ?    = Children not covered in golden snapshot (status not evaluated yet)'
  );
  console.log('  ' + colWidths.map((w) => '-'.repeat(w)).join('---'));
}

/**
 * Recursively compare a single golden snapshot node against the corresponding
 * runtime snapshot node and update comparison statistics.
 *
 * This function is the core of NatVis validation. It:
 *
 * 1) Compares presence:
 *    - Missing actual node:
 *        • If marked as knownProblem on this platform → mark KP.
 *        • Otherwise → record mismatch and mark FAIL.
 *
 * 2) Validates type compatibility:
 *    - Uses `areTypesCompatible(...)`.
 *    - A root-level type incompatibility is considered fatal and throws.
 *
 * 3) Compares value (DisplayString):
 *    - If values differ:
 *        • If knownProblem → mark KP.
 *        • Otherwise → record mismatch and mark FAIL.
 *    - If values match:
 *        • If knownProblem → mark KP + KP* (good news).
 *        • Otherwise → mark OK.
 *
 * 4) Validates children (one level only):
 *    - Children are only evaluated for the root call (`isRoot === true`).
 *    - If the golden entry defines children, each expected child is compared
 *      against the corresponding runtime child (subset comparison).
 *    - Children status is aggregated in `stats.children`.
 *    - If no golden children are defined, the children slice remains
 *      "unset" (unknown=false, no flags set), which maps to '?'.
 *
 * Status model:
 *  - `stats.root` and `stats.children` are updated via small helpers
 *    (markSucceeded, markFail, markKPSeen, markKPGoodNews).
 *  - `unknown` indicates “could not be evaluated” and maps to 'x'.
 *  - If no flags are set and unknown=false, the status falls back to '?'.
 *
 * Notes:
 *  - Only one child level is currently validated (no grandchildren).
 *  - The golden model is treated as authoritative; extra runtime children
 *    are ignored (subset comparison).
 *  - This function does not itself decide pass/fail; it records mismatches
 *    and updates `CompareStats`, which are later rendered by the summary table.
 */
function compareNode(
  actual: Snapshot | undefined,
  expected: GoldenSnapshot,
  natvis: NatvisTypes,
  platform: NodeJS.Platform,
  mismatches: SnapshotMismatch[],
  stats: CompareStats,
  isRoot: boolean
): void {
  const kp = resolvesKnownProblem(expected.knownProblem, platform);

  const expectedChildren = expected.children ?? [];
  const hasGoldenChildren = expectedChildren.length > 0;

  const clearUnknownThisSlice = () => {
    if (isRoot) stats.root.unknown = false;
    else stats.children.unknown = false;
  };

  const markSucceeded = () => {
    if (isRoot) stats.root.succeeded = true;
    else stats.children.succeeded = true;
    clearUnknownThisSlice();
  };

  const markFail = () => {
    if (isRoot) stats.root.failed = true;
    else stats.children.failed = true;
    clearUnknownThisSlice();
  };

  const markKPSeen = () => {
    if (isRoot) stats.root.hadKP = true;
    else stats.children.hadKP = true;
    clearUnknownThisSlice();
  };

  const markKPGoodNews = () => {
    if (isRoot) stats.root.kpGoodNews = true;
    else stats.children.kpGoodNews = true;
    clearUnknownThisSlice();
  };

  // ----------------------------
  // Missing node (root or child)
  // ----------------------------
  if (!actual) {
    if (kp) {
      // Known-problem: do not mark succeeded.
      markKPSeen();

      // If root is missing but golden has children, treat children as KP too (by extension).
      if (isRoot && hasGoldenChildren) {
        stats.children.hadKP = true;
        stats.children.unknown = false; // so this becomes KP (not x)
      }

      return;
    }

    // Real missing variable/child.
    mismatches.push({ name: expected.name, expected });
    markFail();

    return;
  }

  // ----------------------------
  // Type check (hard stop)
  // ----------------------------
  if (!areTypesCompatible(actual.type, expected.type, natvis)) {
    // Root type mismatch means we cannot evaluate children reliably.
    if (isRoot && hasGoldenChildren) {
      stats.children.unknown = true; // x
    }

    throw new Error(
      `[natvis.test] Type incompatibility for '${expected.name}'`
    );
  }

  // ----------------------------
  // Root/child value compare
  // ----------------------------
  const sameValue = actual.value === expected.value;

  if (!sameValue) {
    if (kp) {
      markKPSeen();
    } else {
      mismatches.push({ name: expected.name, actual, expected });
      markFail();
    }
  } else {
    if (kp) {
      // KP but succeeded => KP*
      markKPSeen();
      markKPGoodNews();
    } else {
      // True success
      markSucceeded();
    }
  }

  // If the *root* is a known-problem on this platform, do NOT explore children.
  // Treat children as "unexplored" when golden expects them.
  if (isRoot && kp) {
    stats.children.unknown = false; // so table shows ? (not x)
    return;
  }
  // ----------------------------
  // Children compare (subset)
  // ----------------------------
  if (!isRoot) return; //  only validate one child level (no grandchildren yet)

  // We *are* evaluating children, so ensure children is not "unknown/x".
  stats.children.unknown = false;

  if (!hasGoldenChildren) {
    // Nothing to compare => children slice should remain "unset"
    // so statusFromSlice() returns fallback '?'.
    return;
  }

  const actualByChild = indexByName(actual.children);

  for (const ec of expectedChildren) {
    const ac = actualByChild.get(ec.name);
    compareNode(ac, ec, natvis, platform, mismatches, stats, false);
  }

  // If we compared children and none failed/KP, children succeeded.
  if (!stats.children.failed && !stats.children.hadKP) {
    stats.children.succeeded = true;
  }
}

/**
 * Represents the validation state of a single comparison slice
 * (either the root value or the children level).
 *
 * Exactly one logical outcome is expected in normal cases:
 *   - succeeded  → maps to 'OK'
 *   - failed     → maps to 'FAIL'
 *   - hadKP      → maps to 'KP' (or 'KP*' if kpGoodNews is also true)
 *   - unknown    → maps to 'x' (could not be evaluated)
 *
 * If none of the flags are set and `unknown === false`,
 * the status falls back to '?' (unevaluated / not applicable).
 */
export type StatSlice = {
  succeeded: boolean;
  failed: boolean;
  hadKP: boolean;
  kpGoodNews: boolean;
  unknown: boolean;
};

/**
 * Aggregated comparison result for a single top-level variable.
 *
 * - `root`     describes the status of the variable’s top-level value
 *              (DisplayString comparison).
 * - `children` describes the status of its NatVis Expand children
 *              (currently one level only).
 */
export type CompareStats = {
  root: StatSlice;
  children: StatSlice;
};

/**
 * Per-variable entry stored in `StatsByRoot`.
 *
 * - `exercisedType` is the concrete C++ type reported by the debugger
 *   for this variable (used for NatVis family resolution and coverage).
 * - `stats` contains the aggregated root and children validation state.
 */
export type RowStats = {
  exercisedType: string;
  stats: CompareStats;
};

export type StatsByRoot = ReadonlyMap<string, RowStats>;

/**
 * Describes a single *real* mismatch detected during NatVis snapshot comparison.
 *
 * A mismatch represents a comparison failure after all `knownProblem`
 * exemptions have been applied.
 *
 * It can correspond to one of the following situations:
 *
 *   - **Extra variable**
 *       Present in the debugger snapshot but not defined in the golden snapshot.
 *       (`actual` defined, `expected` undefined)
 *
 *   - **Missing variable**
 *       Defined in the golden snapshot but not present in the debugger snapshot.
 *       (`expected` defined, `actual` undefined)
 *
 *   - **Value mismatch**
 *       Variable present in both snapshots but with a differing value.
 *       (`actual` and `expected` both defined)
 *
 * Notes:
 * - Type incompatibilities are treated as hard errors and are not represented
 *   as `SnapshotMismatch` entries.
 * - Entries marked as `knownProblem` for the current platform are excluded
 *   before this structure is produced.
 * - Therefore, every `SnapshotMismatch` represents a genuine test failure.
 */
export interface SnapshotMismatch {
  readonly name: string;
  readonly actual?: Snapshot;
  readonly expected?: GoldenSnapshot;
}

/**
 * Compare the runtime NatVis snapshot against the golden snapshot and
 * compute:
 *
 *   1) The list of real mismatches (`SnapshotMismatch[]`)
 *   2) Per-root comparison statistics (`StatsByRoot`) used by the summary table
 *
 * High-level behavior:
 *
 * - Matching is performed by **variable name** at the top level.
 * - For each golden entry:
 *     • The corresponding actual snapshot entry (if any) is located.
 *     • `compareNode(...)` is invoked to:
 *         - Record real mismatches (after knownProblem filtering).
 *         - Populate `CompareStats` for both root and children slices.
 * - For each extra actual variable not present in golden:
 *     • A mismatch is recorded.
 *     • A synthetic `CompareStats` entry is created:
 *         - root = FAIL
 *         - children = unknown (since no golden children exist)
 *
 * Important notes:
 *
 * - Type incompatibilities are treated as hard errors inside `compareNode`
 *   and will throw before returning here.
 * - `knownProblem` entries do not produce mismatches; they instead affect
 *   the corresponding `StatSlice` (KP / KP*).
 * - `StatsByRoot` is the single source of truth for the NatVis summary
 *   table; the table renderer must not re-evaluate comparison logic.
 *
 * @param actual   Normalized NatVis snapshot captured from the debugger.
 * @param expected Platform-resolved golden snapshot.
 * @param natvis   Parsed NatVis metadata (bases, alternatives, aliases).
 *
 * @returns
 *   - `mismatches`: real comparison failures.
 *   - `statsByRoot`: per-variable root/children status slices.
 */
export function findMismatchedSnapshotEntries(
  actual: readonly Snapshot[],
  expected: readonly GoldenSnapshot[],
  natvis: NatvisTypes
): {
  mismatches: SnapshotMismatch[];
  statsByRoot: StatsByRoot;
} {
  const statsByRoot = new Map<string, RowStats>();
  const platform = process.platform;

  const mismatches: SnapshotMismatch[] = [];

  const actualByName = new Map<string, Snapshot>();
  for (const a of actual) {
    if (a.name) actualByName.set(a.name, a);
  }

  const expectedByName = new Map<string, GoldenSnapshot>();
  for (const e of expected) {
    if (e.name) expectedByName.set(e.name, e);
  }

  for (const [name, e] of expectedByName) {
    const a = actualByName.get(name);
    const stats: CompareStats = {
      root: {
        succeeded: false,
        failed: false,
        hadKP: false,
        kpGoodNews: false,
        unknown: true
      },
      children: {
        succeeded: false,
        failed: false,
        hadKP: false,
        kpGoodNews: false,
        unknown: true
      }
    };

    compareNode(a, e, natvis, platform, mismatches, stats, true);
    const exercisedType = a?.type ?? '<none>';

    statsByRoot.set(name, {
      exercisedType,
      stats
    });
  }

  // Extra actual variables
  for (const [name, a] of actualByName) {
    if (!expectedByName.has(name)) {
      mismatches.push({ name, actual: a });

      statsByRoot.set(name, {
        exercisedType: a.type ?? '<none>',
        stats: {
          root: {
            succeeded: false,
            failed: true,
            hadKP: false,
            kpGoodNews: false,
            unknown: false
          },
          children: {
            succeeded: false,
            failed: false,
            hadKP: false,
            kpGoodNews: false,
            unknown: true
          }
        }
      });
    }
  }

  return { mismatches, statsByRoot };
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

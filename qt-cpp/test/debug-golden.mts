// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs/promises';

import type { DebugVariable } from './debug-helper.mts';
import { dlog } from './helper.mts';

/**
 * NatVis golden + snapshot utilities for qt-cpp integration tests.
 *
 * This module contains the core data model and helpers used by natvis tests:
 *   - Normalize raw debugger values into stable, comparable strings.
 *   - Materialize a deterministic runtime locals snapshot from flattened Locals.
 *   - Parse NatVis `.natvis` files (including AlternativeType) and compute coverage.
 *   - Define and materialize platform-aware golden expectations into snapshots.
 *   - Provide stable sorting for snapshot entries to keep comparisons deterministic.
 *
 * The code here is intentionally test-focused and aims to remove debugger noise
 * (addresses, float artifacts, formatting differences) without changing NatVis semantics.
 */

/**
 * Normalize unstable parts of debugger values (e.g., pointers, spacing)
 * so snapshots remain stable across runs/platforms.
 */
export function stripUnstable(s: string): string {
  return (
    s
      // hex pointers/addresses
      .replace(/0x[0-9a-fA-F]+/g, '0xADDR')
      // repeated spaces/tabs
      .replace(/[ \t]+/g, ' ')
      // trailing spaces before newlines
      .replace(/\s+\n/g, '\n')
      .trim()
  );
}

/**
 * Normalizes floating-point artifacts produced by GDB/LLDB/cppvsdbg.
 * Converts things like:
 *   5.0999999999999996 : 5.1
 *   4.2000000000000002 : 4.2
 *   3.1415926535897931 : 3.141593
 */
function normalizeFloats(raw: string): string {
  // Match things like 5.1, 5.0999999999999996, 4.2000000000000002, -3.14, etc.
  return raw.replace(/-?\d+\.\d+(?:\d+)?/g, (match) => {
    const n = Number(match);
    if (!Number.isFinite(n)) {
      return match;
    }

    // Round to 6 decimal places (tweak if needed)
    let rounded = n.toFixed(6);

    // Strip trailing zeros and optional trailing dot
    rounded = rounded.replace(/(\.\d*?[1-9])0+$/u, '$1'); // 1.230000 -> 1.23
    rounded = rounded.replace(/\.0+$/u, ''); // 5.000000 -> 5

    return rounded;
  });
}
/**
 * Normalize debugger-produced string values into a single canonical form.
 *
 * Debug adapters (GDB, LLDB, cppvsdbg) print values differently:
 *   - QString / QByteArray may appear as:           "Hello World!", u"Hello World!""
 *   - Or preceded by pointer prefixes:              0x123ABC "Hello World!"
 *   - Struct/geometry types may include float noise: 5.0999999999999996
 *
 * This function removes all debugger-specific decorations so golden files
 * remain stable across platforms:
 *
 *   1) Strips leading pointer prefixes (0x1234..., 0xADDR) even when quoted.
 *   2) Normalizes floating-point artifacts globally (QRectF, QSizeF, etc.).
 *   3) Extracts the final quoted payload for quoted types (QString/QByteArray),
 *      returning the inner text only (no surrounding quotes).
 *   4) Leaves unquoted structs unchanged:
 *          "{ x = 5, y = 6, width = 41, height = 42 }"
 *   5) Does NOT wrap values in quotes — golden files store plain values.
 *
 * The goal is *pure canonicalization*, not type-aware formatting:
 * normalization is applied uniformly to all values, regardless of their type.
 *
 * IMPORTANT:
 *   – This must stay narrow: only collapse debugger noise, never reinterpret
 *     NatVis semantics. NatVis logic itself is verified by the golden.
 *   – Golden files should remain readable and stable; this function enforces that.
 */
export function normalizeValue(raw: string): string {
  let value = raw.trim();

  // Strip leading pointer-like prefixes, with optional opening quote:
  //    "0x1234 "Hello World!""  or  0x1234 "Hello World!"
  value = value.replace(/^"?(0x[0-9A-Fa-f]+|0xADDR)\s*/u, '');
  value = value.trim();

  // Normalize floating-point artifacts everywhere (QRectF, QSizeF, etc.)
  value = normalizeFloats(value);

  // Special case: QChar-style representation
  //    Windows: "99 u'c'"
  //    Other OSes: "99 'c'"
  //    normalize both to "99 'c'"
  const qCharLike = value.match(/^(\d+)\s+u'([^']*)'$/u);
  if (qCharLike) {
    const [, code, ch] = qCharLike;
    return `${code} '${ch}'`;
  }

  // If there is a final quoted payload (optional leading 'u'), extract it:
  //
  //    u"Hello World!""   -> Hello World!
  //    "Hello World!""    -> Hello World!
  //    "Hello World!"     -> Hello World!
  //
  const quoted = value.match(/u?"([^"]*)"\s*"?$/u);
  if (quoted && quoted[1] !== undefined) {
    return quoted[1];
  }

  // Fallbacks for simpler fully-quoted forms, just in case:
  if (value.startsWith('"') && value.endsWith('""') && value.length >= 3) {
    // "Hello World!"" -> Hello World!
    return value.slice(1, -2);
  }
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    // "Hello World!" -> Hello World!
    return value.slice(1, -1);
  }

  // 5) No quotes to strip: structs like { x = 5, ... } just pass through.
  return value;
}

/**
 * Reconstructs a hierarchical snapshot tree from the flat list of variables
 * returned by the debugger (DAP Locals).
 *
 * The debugger reports variables as a flat list with dotted names
 * (e.g. `coreTypes.qPairStringInt.[first].[size]`). This function:
 *
 * 1. Creates a snapshot node for every variable and ensures all dotted
 *    ancestors exist.
 * 2. Rebuilds parent/child relationships based purely on the dotted name
 *    structure, populating `Snapshot.children` instead of keeping a flat list.
 * 3. Normalizes and stabilizes values so they are suitable for deterministic
 *    comparison against golden entries.
 * 4. Sorts the snapshot deterministically at every level.
 * 5. Promotes children of top-level “holder” structs (e.g. `coreTypes`,
 *    `containerTypes`) so that the resulting roots match the golden snapshot
 *    entries (e.g. `coreTypes.qByteArray`).
 *
 * Important design notes:
 * - Only the promoted root entries are intended to be compared against golden
 *   snapshots.
 * - Child entries represent NatVis `Expand` output and are preserved for
 *   inspection and future validation, but are not compared at the moment.
 * - This function does **not** filter by NatVis coverage or type; all debugger
 *   output is materialized so type mismatches cannot be silently hidden.
 *
 * @param vars
 *   Flat list of debugger variables as returned by the DAP `variables` request,
 *   where hierarchy is encoded in dotted variable names.
 *
 * @returns
 *   A deterministic, hierarchical snapshot tree whose roots correspond to
 *   golden snapshot entries and whose children reflect NatVis expansion output.
 */
export function materializeLocalSnapshot(
  vars: readonly DebugVariable[]
): readonly LocalSnapshot[] {
  type MutableSnap = {
    name: string;
    type?: string;
    value?: string;
    children?: MutableSnap[];
  };

  const byName = new Map<string, MutableSnap>();

  const getOrCreate = (name: string): MutableSnap => {
    const existing = byName.get(name);
    if (existing) return existing;

    const created: MutableSnap = { name };
    byName.set(name, created);
    return created;
  };

  const normalizeVarValue = (rawValue: unknown): string | undefined => {
    if (typeof rawValue !== 'string') return undefined;

    const normalized = normalizeValue(rawValue);
    return stripUnstable(normalized);
  };

  // 1) Create/update nodes for every flattened variable.
  for (const v of vars) {
    const name = v.name ?? '';
    if (!name) continue;

    const node = getOrCreate(name);

    // Prefer "real" values/types when present.
    if (v.type) node.type = v.type;

    const stable = normalizeVarValue(v.value);
    if (stable !== undefined) node.value = stable;

    // Ensure all ancestors exist.
    const parts = name.split('.');
    for (let i = 1; i < parts.length; i++) {
      const parentName = parts.slice(0, i).join('.');
      getOrCreate(parentName);
    }
  }

  // 2) Wire parent/child relationships based on dotted names.
  const roots: MutableSnap[] = [];
  for (const [name, node] of byName) {
    const lastDot = name.lastIndexOf('.');
    if (lastDot < 0) {
      roots.push(node);
      continue;
    }

    const parentName = name.slice(0, lastDot);
    const parent = byName.get(parentName);
    if (!parent) {
      roots.push(node);
      continue;
    }

    if (!parent.children) parent.children = [];
    parent.children.push(node);
  }

  // 3) Sort deterministically at every level.
  const sortTree = (nodes: MutableSnap[]): void => {
    nodes.sort((a, b) => {
      const an = (a.name ?? '').localeCompare(b.name ?? '');
      if (an !== 0) return an;
      return (a.type ?? '').localeCompare(b.type ?? '');
    });

    for (const n of nodes) {
      if (n.children && n.children.length) {
        sortTree(n.children);
      }
    }
  };

  sortTree(roots);

  // 4) Promote children of remaining top-level "holder" structs (coreTypes, containerTypes, ...).
  // This matches your golden roots like "coreTypes.qByteArray" instead of "coreTypes".
  const promoted: MutableSnap[] = [];
  for (const r of roots) {
    if (r.children && r.children.length) {
      promoted.push(...r.children);
    } else {
      // If a top-level root has no children, keep it as-is (rare, but safe).
      promoted.push(r);
    }
  }

  sortTree(promoted);
  dlog(
    '[natvis.test] Snapshot after noise filtering (JSON):\n' +
      JSON.stringify(promoted.map(snapshotToJSON), null, 2)
  );

  return promoted;
}

/**
 * Collect all distinct `type` strings appearing in a snapshot tree.
 *
 * This helper walks a `LocalSnapshot` hierarchy (including nested children)
 * and returns the set of debugger-reported type names that actually appeared
 * in the captured Locals.
 *
 * It is primarily used for NatVis coverage analysis, to determine:
 *   - which NatVis type patterns were exercised by a test run,
 *   - which snapshot entries should be considered for NatVis filtering.
 *
 * @param s  Root snapshot entries to traverse.
 * @returns  Set of unique type names found in the snapshot.
 */
export function collectTypesFromSnapshot(
  s: readonly LocalSnapshot[]
): Set<string> {
  const out = new Set<string>();

  const visit = (xs: readonly LocalSnapshot[]): void => {
    for (const v of xs) {
      if (v.type) {
        out.add(v.type);
      }
      if (v.children) {
        visit(v.children);
      }
    }
  };

  visit(s);
  return out;
}

//decode &lt; &gt; &amp; &quot; &apos; in attribute values
function decodeXmlEntities(input: string): string {
  const map: Record<string, string> = {
    '&lt;': '<',
    '&gt;': '>',
    '&amp;': '&',
    '&quot;': '"',
    '&apos;': "'"
  };
  return input.replace(/&(lt|gt|amp|quot|apos);/g, (m) => map[m] ?? m);
}

/**
 * Structured representation of NatVis type patterns extracted from a `.natvis` file.
 *
 * This type captures the *logical shape* of NatVis coverage rules after parsing,
 * including base type patterns and their declared alternative forms.
 *
 * Fields:
 *   - `all`   : All type patterns defined in the NatVis file, including bases
 *               and AlternativeType entries.
 *   - `bases` : The primary (base) type patterns declared via `<Type Name="...">`.
 *   - `alts`  : Mapping from a base type pattern to the set of its
 *               `<AlternativeType>` patterns.
 *   - `altToBase`  : Reverse mapping from an `<AlternativeType>` pattern to its
 *                    base type pattern, derived from the NatVis file.
 *
 * This structure is used by NatVis tests to:
 *   - Match runtime snapshot types against NatVis rules,
 *   - Reason about coverage (which rules were exercised or missed),
 *   - Correctly handle AlternativeType equivalence during comparison.
 *
 * It is a test-oriented abstraction and does not attempt to model the full
 * NatVis schema or debugger behavior.
 */
export type NatvisTypes = {
  all: Set<string>;
  bases: Set<string>;
  alts: Map<string, Set<string>>;
  altToBase: Map<string, string>;
};

/**
 * Parses a NatVis (.natvis) file and extracts all declared type patterns,
 * including base <Type Name="..."> entries and their <AlternativeType> mappings.
 *
 * The returned structure is used for:
 * - NatVis coverage reporting (which patterns were exercised or not),
 * - relaxed type compatibility checks in NatVis tests
 *   (e.g. QPoint ↔ QPointF via AlternativeType),
 * - avoiding any hard-coded knowledge of Qt type equivalence.
 *
 * Notes:
 * - `alts` maps a base type to its AlternativeType set as declared in NatVis.
 * - `altToBase` provides the reverse lookup (AlternativeType → base),
 *   built deterministically from the NatVis file.
 * - Stray <AlternativeType> elements outside of a <Type> block (rare) are
 *   added to `all` for completeness, but cannot be reliably associated to a base
 *   and therefore do not populate `altToBase`.
 *
 * NatVis is treated as the single source of truth for type equivalence.
 */
export async function parseNatvisTypesWithAlternatives(
  natvisPath: string
): Promise<NatvisTypes> {
  const all = new Set<string>();
  const bases = new Set<string>();
  const alts = new Map<string, Set<string>>();
  const altToBase = new Map<string, string>();

  // Seed reverse aliases from EXTRA_NATVIS_TYPE_ALIASES.
  // Example:
  //   'QList<*>' : ['QByteArrayList', 'QStringList']
  // becomes:
  //   altToBase['QByteArrayList'] = 'QList<*>'
  //   altToBase['QStringList']    = 'QList<*>'
  for (const [pattern, aliasNames] of Object.entries(
    EXTRA_NATVIS_TYPE_ALIASES
  )) {
    for (const alias of aliasNames) {
      if (!altToBase.has(alias)) {
        altToBase.set(alias, pattern);
      }
    }
    all.add(pattern);
    bases.add(pattern);
  }

  try {
    const xml = await fs.readFile(natvisPath, 'utf8');
    const withoutComments = xml.replace(/<!--[\s\S]*?-->/g, '');

    // Capture each <Type ...> ... </Type> block
    const typeBlockRe = /<\s*Type\b([^>]*)>([\s\S]*?)<\/\s*Type\s*>/g;

    let m: RegExpExecArray | null;
    while ((m = typeBlockRe.exec(withoutComments))) {
      const typeOpenAttrs = m[1] ?? '';
      const typeInner = m[2] ?? '';

      const nameAttr = /(?:^|\s)Name\s*=\s*"([^"]+)"/.exec(typeOpenAttrs);
      if (!nameAttr) continue;

      const baseRaw = nameAttr[1];
      if (!baseRaw) continue;
      const base = decodeXmlEntities(baseRaw).trim();
      if (!base) continue;

      bases.add(base);
      all.add(base);

      // Collect <AlternativeType Name="..."> inside this block
      const altRe = /<\s*AlternativeType\b[^>]*\bName\s*=\s*"([^"]+)"/g;
      let am: RegExpExecArray | null;
      while ((am = altRe.exec(typeInner))) {
        const altRaw = am[1];
        if (!altRaw) continue;
        const alt = decodeXmlEntities(altRaw).trim();
        if (!alt) continue;

        all.add(alt);

        let set = alts.get(base);
        if (!set) {
          set = new Set<string>();
          alts.set(base, set);
        }
        set.add(alt);

        // Reverse mapping: AlternativeType → base
        // (first writer wins deterministically)
        if (!altToBase.has(alt)) {
          altToBase.set(alt, base);
        }
      }
    }

    // Also catch any stray AlternativeType outside <Type> blocks (rare).
    // These are recorded for coverage purposes but cannot be mapped to a base.
    const strayAltRe = /<\s*AlternativeType\b[^>]*\bName\s*=\s*"([^"]+)"/g;
    while ((m = strayAltRe.exec(withoutComments))) {
      const rawAlt = m?.[1];
      if (!rawAlt) continue;
      const alt = decodeXmlEntities(rawAlt).trim();
      if (alt) all.add(alt);
    }

    return { all, bases, alts, altToBase };
  } catch {
    return { all, bases, alts, altToBase };
  }
}

/**
 * Convert a NatVis-style wildcard pattern (using `*`) into a full RegExp.
 *
 * The input pattern is safely regex-escaped, with `*` translated to `.*`,
 * and anchored so that the resulting RegExp matches the entire string.
 *
 * @param pat  Wildcard pattern from a NatVis Type Name or AlternativeType.
 * @returns    RegExp that matches strings covered by the given pattern.
 */
function wildcardToRegex(pat: string): RegExp {
  // Escape regex specials, then turn \* into .*
  const rx =
    '^' +
    pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*') +
    '$';
  return new RegExp(rx);
}

// Extra aliases for types whose *real* NatVis rule is more generic.
// Here: SelectionFlags is a typedef / Q_DECLARE_FLAGS wrapper around QFlags<SelectionFlag>,
// but the debugger reports the typedef name "SelectionFlags".
export const EXTRA_NATVIS_TYPE_ALIASES: Record<string, string[]> = {
  // NatVis pattern       // Snapshot types to treat as covered by that pattern
  'QFlags<*>': ['SelectionFlags'],
  'QList<*>': ['QByteArrayList', 'QStringList', 'QVariantList'],
  'QPair<*,*>': ['std::pair'],
  'QHash<*,*>': ['QVariantHash'],
  'QMap<*,*>': ['QVariantMap']
};
/**
 * A base is covered if base OR ANY of its alternatives matches a seen type.
 * Returns missing base names (not each alt).
 */
export function matchNatvisTypePatternsConsideringAlternatives(
  natvis: NatvisTypes,
  seenTypes: Set<string>
): {
  missing: string[];
  coveredTypes: Set<string>;
} {
  const seen = [...seenTypes];
  const missing: string[] = [];
  const coveredTypes = new Set<string>();

  for (const base of natvis.bases) {
    const candidates = [base, ...(natvis.alts.get(base) ?? [])];
    const anyMatched = candidates.some((pat) => {
      const rx = wildcardToRegex(pat);
      return seen.some((t) => {
        const ok = rx.test(t);
        if (ok) {
          // Mark this seen type as covered by some NatVis pattern
          coveredTypes.add(t);
        }
        return ok;
      });
    });
    if (!anyMatched) missing.push(base);
  }
  // --- Alias typedef-like types to their underlying NatVis patterns ----
  for (const aliases of Object.values(EXTRA_NATVIS_TYPE_ALIASES)) {
    for (const alias of aliases) {
      if (seenTypes.has(alias)) {
        coveredTypes.add(alias);
      }
    }
  }
  return { missing: missing.sort(), coveredTypes };
}

// ---------------------------------------------------------------------------
// Golden entries: logical expectations with per-platform values
// ---------------------------------------------------------------------------

type PlatformTag = NodeJS.Platform | readonly NodeJS.Platform[] | undefined;

/**
 * Does this tag apply to the given platform?
 *
 * - undefined : applies everywhere
 * - string    : only that platform
 * - array     : any of those platforms
 */
export function matchesPlatformTag(
  tag: PlatformTag,
  current: NodeJS.Platform
): boolean {
  if (!tag) {
    return true; // no restriction
  }
  if (Array.isArray(tag)) {
    return tag.includes(current);
  }
  return tag === current;
}

// ---------------------------------------------------------------------------
// Snapshot types (config-time: platform-aware, runtime: platform-resolved)
// ---------------------------------------------------------------------------

/**
 * Per-platform value (value, known problem...).
 *
 * - all   : default for every platform, unless overridden
 * - darwin / linux / win32 : override for that specific platform
 */
export interface ValueByPlatform {
  readonly all?: string;
  readonly darwin?: string;
  readonly linux?: string;
  readonly win32?: string;
}

/**
 * Platform-aware snapshot config.
 *
 * Used as a base for both:
 *   - golden snapshot config (per-platform values and problems)
 *   - runtime locals config (if we ever need that)
 *
 * At this level, `value` can be either:
 *   - a plain string, or
 *   - an ValueByPlatform (per-platform overrides).
 */
export interface SnapshotBase<TChildConfig> {
  readonly name: string;
  readonly type?: string;
  readonly value?: string | ValueByPlatform;
  readonly children?: readonly TChildConfig[];
}

/**
 * Runtime snapshot (locals or materialized golden) where:
 *   - platform has been resolved and removed,
 *   - value is a single string,
 *   - children are also platform-resolved Snapshot values.
 */
export interface Snapshot
  extends Omit<SnapshotBase<Snapshot>, 'value' | 'children'> {
  readonly value?: string;
  readonly children?: readonly Snapshot[];
}

/**
 * Concrete snapshot shape for "actual" locals from the debugger.
 * For now this is just an alias of Snapshot, to keep existing naming.
 */
export type LocalSnapshot = Snapshot;

// Keep this alias for now so existing code using SnapVar compiles.
export type SnapVar = Snapshot;

// ---------------------------------------------------------------------------
// Golden snapshot config vs runtime golden snapshot
// ---------------------------------------------------------------------------

export interface GoldenEntryElement extends SnapshotBase<GoldenEntryElement> {}

/**
 * Platform-aware golden snapshot config.
 *
 * Extends the generic SnapshotConfigBase by adding an optional per-platform
 * knownProblem. Both `value` and `knownProblem` are described in a
 * per-platform way using ValueByPlatform.
 */
export interface GoldenEntryInput //<TChildConfig>
  extends SnapshotBase<GoldenEntryElement> {
  //<TChildConfig> {
  readonly platform?: NodeJS.Platform | readonly NodeJS.Platform[];
  readonly knownProblem?: ValueByPlatform;
}

/**
 * Runtime golden snapshot:
 *   - platform-specific parts (value, knownProblem) are already resolved
 *   - platform field is gone
 *   - children are also GoldenSnapshot values
 */
export interface GoldenSnapshot
  extends Omit<
    GoldenEntryInput,
    'platform' | 'value' | 'children' | 'knownProblem'
  > {
  readonly value?: string;
  readonly children?: readonly Snapshot[];
  readonly knownProblem?: string;
}

/**
 * Declarative representation of a single golden NatVis entry.
 *
 * A `GoldenEntry` describes the *expected* debugger representation of one
 * variable (and its optional children) in a platform-aware, test-friendly way.
 * It is the source-of-truth structure used to build concrete
 * `GoldenSnapshot` objects for comparison against runtime Locals.
 *
 * Key characteristics:
 *   - **Platform-aware**:
 *       • `value` and `knownProblem` may be specified per-platform
 *         (`darwin`, `linux`, `win32`) or as a shared `all` fallback.
 *       • `platform` controls whether this entry applies to the current OS.
 *   - **Tree-structured**:
 *       • Supports nested children to model expanded NatVis structures.
 *       • Children are recursively materialized into snapshot form.
 *   - **Test-oriented**:
 *       • `knownProblem` annotations live directly on the golden entry,
 *         allowing per-variable exemptions without global tables.
 *
 * The class is intentionally immutable and lightweight:
 * it performs no comparison itself, only *materialization* into
 * platform-resolved `GoldenSnapshot` objects.
 */
export class GoldenEntry {
  readonly name: string;
  readonly type: string | undefined;
  readonly value: string | ValueByPlatform | undefined;
  readonly platform: PlatformTag;
  readonly knownProblem: ValueByPlatform | undefined;
  readonly children: readonly GoldenEntryElement[] | undefined;

  constructor(init: GoldenEntryInput) {
    this.name = init.name;
    this.type = init.type;
    this.value = init.value;
    this.platform = init.platform;
    this.knownProblem = init.knownProblem;
    this.children = init.children;
  }

  /**
   * Resolve a string | ValueByPlatform based on the current platform.
   *
   * Used for BOTH:
   *   - the value
   *   - the knownProblem
   */
  private resolveForPlatform(
    spec: string | ValueByPlatform | undefined,
    platform: NodeJS.Platform
  ): string | undefined {
    if (spec === undefined) return undefined;

    if (typeof spec === 'string') return spec;

    switch (platform) {
      case 'darwin':
        return spec.darwin ?? spec.all;
      case 'linux':
        return spec.linux ?? spec.all;
      case 'win32':
        return spec.win32 ?? spec.all;
      default:
        return spec.all;
    }
  }

  private materializeTree(
    cfg: GoldenEntryElement,
    platform: NodeJS.Platform
  ): Snapshot {
    const resolvedValue = this.resolveForPlatform(cfg.value, platform);

    const childSnaps =
      cfg.children && cfg.children.length
        ? cfg.children.map((c) => this.materializeTree(c, platform))
        : undefined;

    return {
      name: cfg.name,
      ...(cfg.type ? { type: cfg.type } : {}),
      ...(resolvedValue !== undefined ? { value: resolvedValue } : {}),
      ...(childSnaps && childSnaps.length
        ? { children: sortSnapshotEntries(childSnaps) }
        : {})
    };
  }
  /**
   *
   * Convert this entry into a GoldenSnapshot for `platform`.
   * Returns undefined if the entry is excluded by a platform tag.
   */
  toGoldenSnapshot(platform: NodeJS.Platform): GoldenSnapshot | undefined {
    if (!matchesPlatformTag(this.platform, platform)) {
      return undefined;
    }

    // Build a GoldenEntryElement-compatible root config,
    // omitting optional fields when they are undefined.
    const rootCfg: GoldenEntryElement = {
      name: this.name,
      ...(this.type ? { type: this.type } : {}),
      ...(this.value !== undefined ? { value: this.value } : {}),
      ...(this.children && this.children.length
        ? { children: this.children }
        : {})
    };

    // Reuse the same logic as for children, but start from the root fields.
    const baseSnap = this.materializeTree(rootCfg, platform);

    const resolvedProblem = this.resolveForPlatform(
      this.knownProblem,
      platform
    );

    return {
      ...baseSnap,
      ...(resolvedProblem !== undefined
        ? { knownProblem: resolvedProblem }
        : {})
    };
  }
}

/**
 * Materialize a platform-specific golden snapshot from declarative
 * `GoldenEntry` definitions.
 *
 * This function converts the high-level, platform-agnostic golden entries
 * into the concrete `Snapshot` form used for comparison against runtime
 * debugger Locals.
 *
 * Behavior:
 *   - Resolves each `GoldenEntry` for the given platform by:
 *       • applying platform filters,
 *       • resolving platform-specific values and known-problem annotations,
 *       • recursively materializing child entries.
 *   - Drops entries that do not apply to the current platform.
 *   - Sorts the resulting snapshot entries to ensure stable ordering
 *     for deterministic comparisons.
 *
 * This is the single entry point that bridges **declarative golden data**
 * and **runtime snapshot comparison**.
 *
 * @param entries   Declarative golden entries describing expected NatVis output.
 * @param platform  Current platform (`process.platform`) used for resolution.
 * @returns         A sorted, platform-resolved golden snapshot.
 */
export function materializeGoldenSnapshot(
  entries: readonly GoldenEntry[],
  platform: NodeJS.Platform
): readonly Snapshot[] {
  const snaps = entries
    .map((e) => e.toGoldenSnapshot(platform))
    .filter((s): s is Snapshot => s !== undefined);

  return sortSnapshotEntries(snaps);
}

/**
 * Return a stable, deterministic ordering of snapshot-like entries.
 *
 * Entries are sorted lexicographically by:
 *   1) `name`
 *   2) `type` (as a tie-breaker)
 *
 * This helper is used throughout NatVis snapshot and golden materialization
 * to ensure comparisons are:
 *   - independent of debugger iteration order,
 *   - stable across platforms and runs,
 *   - resilient to internal reordering of children.
 *
 * @param entries  Snapshot-like objects to sort.
 * @returns        A new array containing the sorted entries.
 */
export function sortSnapshotEntries<T extends { name?: string; type?: string }>(
  entries: readonly T[]
): readonly T[] {
  return [...entries].sort((a, b) => {
    const an = (a.name ?? '').localeCompare(b.name ?? '');
    if (an !== 0) {
      return an;
    }
    return (a.type ?? '').localeCompare(b.type ?? '');
  });
}

function snapshotToJSON(s: Snapshot): unknown {
  return {
    name: s.name,
    type: s.type,
    value: s.value,
    ...(s.children && s.children.length
      ? { children: s.children.map(snapshotToJSON) }
      : {})
  };
}

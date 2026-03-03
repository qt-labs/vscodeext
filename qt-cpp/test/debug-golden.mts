// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs/promises';

import type { DebugVariable } from './debug-helper.mts';

/**
 * NatVis `<Type Name="...">` patterns that should not be treated as “missing coverage”.
 *
 * These are support / helper / internal implementation types that are exercised
 * indirectly when the corresponding public-facing Qt types are present in the snapshot.
 *
 * Notes:
 * - We intentionally do NOT skip QBasicAtomicPointer<void>. If it is uncovered, add a
 *   top-level sample variable to exercise it.
 * - QPropertyData<*> is skipped until the test validates Expand/children. Today we only
 *   validate root DisplayString values, so requiring QPropertyData<*> would be misleading.
 */
export const SKIP_COVERAGE_BASES: ReadonlySet<string> = new Set<string>([
  // QProperty support: exercised via QProperty<T>, but only observable once Expand/children is validated
  'QPropertyData<*>',

  // Qt Quick support: exercised via QQuickItem (d_ptr.d expands into QQuickItemPrivate)
  'QQuickItemPrivate',

  // CBOR/JSON backend support: exercised via QCborArray/QCborMap/QCborValue and QJsonObject/QJsonArray/QJsonDocument
  'QCborContainerPrivate',
  'QtCbor::ByteData',
  'QtCbor::Element',
  'QJsonDocumentPrivate',
  'QJsonValueRef',
  'QJsonValueConstRef',

  // QHash internals: exercised via QHash<*,*> and QMultiHash<*,*>
  'QHashPrivate::Node<*,*>',
  'QHashPrivate::Node<*,QHashDummyValue>',
  'QHashPrivate::MultiNode<*,*>',

  // Legacy / compat helper
  'QStringRef',

  // Qt internal helper template; not a direct “fixture type”
  'QSpecialInteger<*>'
]);

export const SKIP_COVERAGE_REASONS: ReadonlyMap<string, string> = new Map([
  [
    'QPropertyData<*>',
    'Internal support for QProperty<T>; observable only once children/Expand is validated'
  ],
  [
    'QQuickItemPrivate',
    'Qt Quick private backing type; exercised indirectly via QQuickItem'
  ],
  [
    'QCborContainerPrivate',
    'CBOR/JSON backend type; exercised indirectly via QCbor*/QJson* public types'
  ],
  [
    'QtCbor::ByteData',
    'CBOR backend helper; exercised indirectly via QCborValue/containers'
  ],
  [
    'QtCbor::Element',
    'CBOR backend helper; exercised indirectly via QCborValue/containers'
  ],
  [
    'QJsonDocumentPrivate',
    'JSON backend private; exercised indirectly via QJsonDocument'
  ],
  [
    'QJsonValueRef',
    'JSON ref helper; exercised indirectly via QJsonArray/QJsonObject element access'
  ],
  [
    'QJsonValueConstRef',
    'JSON const-ref helper; exercised indirectly via QJsonArray/QJsonObject element access'
  ],
  [
    'QHashPrivate::Node<*,*>',
    'QHash internal node; exercised indirectly via QHash/QMultiHash'
  ],
  [
    'QHashPrivate::Node<*,QHashDummyValue>',
    'QHash internal node; exercised indirectly via QHash/QMultiHash'
  ],
  [
    'QHashPrivate::MultiNode<*,*>',
    'QHash internal node; exercised indirectly via QHash/QMultiHash'
  ],
  [
    'QStringRef',
    'Legacy/compat type; intentionally not required by the fixture'
  ],
  ['QSpecialInteger<*>', 'Internal helper template; not a fixture surface type']
]);

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
 * Normalize a raw debugger `value` string into a stable, comparable form.
 *
 * Goal:
 * - Remove debugger-/adapter-specific noise so golden snapshots remain stable
 *   across platforms (GDB/LLDB/cppvsdbg) and runs.
 *
 * Behavior (in order):
 * 1) If `rawValue` is not a string, returns `undefined` (caller can skip value).
 * 2) Trims leading/trailing whitespace.
 * 3) Strips leading pointer/address prefixes that some debuggers prepend, e.g.:
 *      0x1234 "Hello"
 *      "0x1234 "Hello""
 *    (addresses are already de-noised to `0xADDR` by `stripUnstable`, but we also
 *     handle it here to keep the pipeline robust).
 * 4) Normalizes floating-point artifacts (e.g. 4.2000000000000002 -> 4.2).
 * 5) Special-case normalization for `char16_t` (QString ArrayItems / Expand):
 *    - "U+0048 u'H'" -> "u'H'"
 *    - "72 'H'"      -> "u'H'"
 *    - "72 u'H'"     -> "u'H'"
 *    This keeps golden child values short and consistent.
 * 6) Special-case QChar-like numeric prefix form (mostly Windows):
 *    - "99 u'c'" -> "99 'c'"
 * 7) If the value ends with a quoted payload (optional `u` prefix), extracts the
 *    inner text and drops quotes:
 *      u"Hello""  -> Hello
 *      "Hello""   -> Hello
 *      "Hello"    -> Hello
 * 8) Otherwise, returns the (trimmed + float-normalized) value as-is.
 *
 * Notes:
 * - This function is intentionally narrow: it only removes formatting noise and
 *   should never reinterpret NatVis semantics.
 * - Apply `stripUnstable(...)` after this to remove remaining unstable patterns
 *   like hex addresses, repeated spaces, etc.
 */
export function normalizeValue(
  rawValue: unknown,
  typeText?: string
): string | undefined {
  if (typeof rawValue !== 'string') return undefined;

  let value = rawValue.trim();

  // Strip leading pointer-like prefixes, with optional opening quote:
  //    "0x1234 "Hello World!""  or  0x1234 "Hello World!"
  value = value.replace(/^"?(0x[0-9A-Fa-f]+|0xADDR)\s*/u, '').trim();

  // Normalize floating-point artifacts everywhere (QRectF, QSizeF, etc.)
  value = normalizeFloats(value);

  // Some debuggers (notably cppvsdbg) report QChar child nodes ([latin 1]/[unicode])
  // as an int formatted like: "99 'c'". Normalize to just "'c'" for stable goldens.
  if (typeText === 'int') {
    const intChar = value.match(/^\d+\s+'([^']*)'$/u);
    if (intChar) return `'${intChar[1]}'`;
  }
  // ---- character-like literal normalization ----
  // Handles debugger formats like:
  //   char     : "72 'H'"        -> "'H'"
  //   char16_t : "72 'H'"        -> "u'H'"
  //   char16_t : "U+0048 u'H'"   -> "u'H'"
  //   char16_t : "72 u'H'"       -> "u'H'"
  if (typeText === 'char' || typeText === 'char16_t') {
    const wantUPrefix = typeText === 'char16_t';

    // If we already have u'X', keep it (char16_t) or strip u (char)
    const uLit = value.match(/u'([^']*)'/u);
    if (uLit) return wantUPrefix ? `u'${uLit[1]}'` : `'${uLit[1]}'`;

    // Numeric prefix form: "72 'H'" or "72 u'H'"
    const asciiLit = value.match(/^\d+\s+u?'([^']*)'$/u);
    if (asciiLit) return wantUPrefix ? `u'${asciiLit[1]}'` : `'${asciiLit[1]}'`;
  }

  // ---- QChar-style representation ----
  // Windows: "99 u'c'"
  // Other OSes: "99 'c'"
  // normalize both to "99 'c'"
  const qCharLike = value.match(/^(\d+)\s+u'([^']*)'$/u);
  if (qCharLike) {
    const [, code, ch] = qCharLike;
    return `${code} '${ch}'`;
  }

  // If there is a final quoted payload (optional leading 'u'), extract it:
  const quoted = value.match(/u?"([^"]*)"\s*"?$/u);
  if (quoted && quoted[1] !== undefined) return quoted[1];

  // Fallbacks for simpler fully-quoted forms
  if (value.startsWith('"') && value.endsWith('""') && value.length >= 3) {
    return value.slice(1, -2);
  }
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    return value.slice(1, -1);
  }

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
 * Skipping support variables:
 * - Variables whose dotted path contains a segment starting with `support_`
 *   (e.g. `coreStateTypes.support_atomicTarget`) are intentionally skipped.
 * - These support variables exist only to back other variables (e.g. as stable
 *   pointer targets) and are not part of the NatVis coverage surface.
 * - Skipping happens before the snapshot tree is built so support variables
 *   cannot appear as promoted roots, mismatches, or rows in the summary table.

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
  const shouldSkipSnapshotVar = (fullName: string): boolean => {
    // Skip any variable whose dotted path contains a "support_" segment.
    // Example: "coreStateTypes.support_atomicTarget"
    const parts = fullName.split('.');
    return parts.some((p) => p.startsWith('support_'));
  };

  const getOrCreate = (name: string): MutableSnap => {
    const existing = byName.get(name);
    if (existing) return existing;

    const created: MutableSnap = { name };
    byName.set(name, created);
    return created;
  };

  // 1) Create/update nodes for every flattened variable.
  for (const v of vars) {
    const name = v.name ?? '';
    if (!name) continue;

    if (shouldSkipSnapshotVar(name)) {
      if (process.env.NATVIS_VERBOSE === '1') {
        console.log(`[natvis.test][skip] Skipping support variable '${name}'`);
      }
      continue;
    }

    const node = getOrCreate(name);

    // Prefer "real" values/types when present.
    if (v.type) node.type = v.type;

    //const stable = normalizeVarValue(v.value, v.type);
    let stable: string | undefined;
    const normalized = normalizeValue(v.value, v.type);
    if (normalized !== undefined) stable = stripUnstable(normalized);
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
  const qString = promoted.find(
    (p) => p.name === 'containerTypes.qHashStringInt'
  );
  if (qString) {
    console.log(
      '[natvis.test] Snapshot for containerTypes.qHashStringInt:\n' +
        JSON.stringify(snapshotToJSON(qString), null, 2)
    );
  }
  if (process.env.NATVIS_VERBOSE === '1') {
    console.log(
      '[natvis.test] Snapshot after noise filtering (JSON):\n' +
        JSON.stringify(promoted.map(snapshotToJSON), null, 2)
    );
  }

  return promoted;
}

// Decode &lt; &gt; &amp; &quot; &apos; in attribute values
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
 * Structured representation of NatVis type metadata used by the test framework.
 *
 * `NatvisTypes` is a *test-oriented abstraction* built from parsing a `.natvis`
 * file. It captures the logical structure of NatVis type rules in a form that
 * supports:
 *
 *   - Coverage analysis (which NatVis rules were exercised or missed),
 *   - Type-family grouping in the summary table,
 *   - Relaxed type compatibility checks (via AlternativeType and aliases),
 *   - Explicit exclusion of internal / helper rules from coverage reporting.
 *
 * It is **not** a full NatVis schema model; it only represents the information
 * needed by the NatVis tests.
 *
 * Fields:
 * - `all`
 *     All type patterns declared in the NatVis file, including base `<Type Name="…">`
 *     entries *and* `<AlternativeType>` patterns.
 *
 * - `bases`
 *     The primary NatVis base patterns, corresponding exactly to
 *     `<Type Name="…">` entries in the NatVis file.
 *     These are the units used for coverage reporting.
 *
 * - `alts`
 *     Mapping from a NatVis base pattern to the set of its declared
 *     `<AlternativeType>` patterns.
 *
 * - `altToBase`
 *     Reverse lookup mapping an AlternativeType (or equivalent alias)
 *     back to its canonical NatVis base pattern.
 *     Used to normalize concrete debugger types into stable NatVis “families”.
 *
 * - `extraAliases`
 *     Test-defined aliases that supplement NatVis `<AlternativeType>` rules.
 *     This is used to bridge gaps where the debugger reports typedefs or
 *     expanded template spellings not explicitly covered by NatVis.
 *     (e.g. `SelectionFlags` → `QFlags<*>`).
 *
 * - `skipCoverageBases`
 *     Set of NatVis base patterns that should be *excluded* from “missing coverage”
 *     reporting.
 *
 *     These typically represent:
 *       - private implementation types (e.g. `QQuickItemPrivate`)
 *       - internal support structures (e.g. `QHashPrivate::*`)
 *       - helper templates not observable at the root level
 *         until children/Expand validation exists (e.g. `QPropertyData<*>`)
 *
 *     Skipped bases are considered exercised *indirectly* when their associated
 *     public-facing Qt types are present in the snapshot.
 *
 * - `skipCoverageReasons`
 *     Optional human-readable explanations for entries in `skipCoverageBases`.
 *     Used only for verbose diagnostic output to make coverage decisions
 *     explicit and auditable in test logs.
 */
export type NatvisTypes = {
  all: Set<string>;
  bases: Set<string>;
  alts: Map<string, Set<string>>;
  altToBase: Map<string, string>;
  extraAliases?: ReadonlyMap<string, readonly string[]>;
  skipCoverageBases?: ReadonlySet<string>;
  skipCoverageReasons?: ReadonlyMap<string, string>; // optional but useful
  basesHaveExpand: ReadonlyMap<string, boolean>;
};

// Extra aliases for types whose *real* NatVis rule is more generic.
// Here: SelectionFlags is a typedef / Q_DECLARE_FLAGS wrapper around QFlags<SelectionFlag>,
// but the debugger reports the typedef name "SelectionFlags".
export const EXTRA_NATVIS_TYPE_ALIASES: Record<string, string[]> = {
  // NatVis pattern       // Snapshot types to treat as covered by that pattern
  'QFlags<*>': ['SelectionFlags', 'CoreStateFlags', 'QFlags<CoreStateFlag>'],
  'QList<*>': ['QByteArrayList', 'QStringList', 'QVariantList'],
  'QPair<*,*>': ['std::pair'],
  'QHash<*,*>': ['QVariantHash'],
  'QMap<*,*>': ['QVariantMap']
};

/**
 * Parse a NatVis `.natvis` file and extract the type-pattern metadata needed by the tests.
 *
 * This is the canonical “NatVis ingestion” step for the test suite. It reads the XML,
 * removes comments, and collects:
 *
 *   - Base NatVis patterns from `<Type Name="...">` into `bases`
 *   - All declared patterns (bases + `<AlternativeType Name="...">`) into `all`
 *   - Forward AlternativeType mapping (`alts`: base → alternatives)
 *   - Reverse AlternativeType mapping (`altToBase`: alternative → base)
 *
 * In addition, this function seeds `altToBase` with test-defined aliases from
 * `EXTRA_NATVIS_TYPE_ALIASES` to cover debugger-reported typedef names or template
 * spellings that are not explicitly declared in the NatVis file.
 *
 * Robustness / failure behavior:
 *   - If the file cannot be read or parsed, the function returns empty NatVis sets/maps,
 *     but still includes the test’s coverage-skip policy (`skipCoverageBases` and
 *     `skipCoverageReasons`) so the rest of the reporting code can behave consistently.
 *
 * Notes:
 *   - XML entities in attribute values (e.g. `&lt;`, `&gt;`, `&amp;`) are decoded so
 *     type patterns match the debugger’s type spelling.
 *   - “Stray” `<AlternativeType>` elements outside a `<Type>` block are added to `all`
 *     for completeness, but cannot be reliably associated with a base type and therefore
 *     do not populate `altToBase` unless explicitly seeded via aliases.
 *
 * @param natvisPath Absolute path to the NatVis file to parse.
 * @returns          A populated `NatvisTypes` structure used for coverage, grouping,
 *                   and type-compatibility checks.
 */
export async function parseNatvisTypesWithAlternatives(
  natvisPath: string
): Promise<NatvisTypes> {
  const all = new Set<string>();
  const bases = new Set<string>();
  const alts = new Map<string, Set<string>>();
  const altToBase = new Map<string, string>();
  // keep the forward alias table around for type-compatibility checks
  // (typedef vs expanded template spelling, etc.)
  const extraAliases = new Map<string, readonly string[]>(
    Object.entries(EXTRA_NATVIS_TYPE_ALIASES)
  );
  const basesHaveExpand = new Map<string, boolean>();

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

      const hasExpand =
        /<\s*Expand\b/.test(typeInner) || /<\s*ArrayItems\b/.test(typeInner);

      basesHaveExpand.set(base, hasExpand);

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

    return {
      all,
      bases,
      alts,
      altToBase,
      extraAliases,
      skipCoverageBases: SKIP_COVERAGE_BASES,
      skipCoverageReasons: SKIP_COVERAGE_REASONS,
      basesHaveExpand
    };
  } catch {
    return {
      all,
      bases,
      alts,
      altToBase,
      extraAliases,
      skipCoverageBases: SKIP_COVERAGE_BASES,
      skipCoverageReasons: SKIP_COVERAGE_REASONS,
      basesHaveExpand
    };
  }
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
// Golden-only node shape
export interface GoldenSnapshotBase<TChildConfig>
  extends SnapshotBase<TChildConfig> {
  readonly knownProblem?: ValueByPlatform;
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

//export interface GoldenEntryElement extends SnapshotBase<GoldenEntryElement> {}
export interface GoldenEntryElement
  extends GoldenSnapshotBase<GoldenEntryElement> {}

/**
 * Platform-aware golden snapshot config.
 *
 * Extends the generic SnapshotConfigBase by adding an optional per-platform
 * knownProblem. Both `value` and `knownProblem` are described in a
 * per-platform way using ValueByPlatform.
 */
// export interface GoldenEntryInput //<TChildConfig>
//   extends SnapshotBase<GoldenEntryElement> {
//   //<TChildConfig> {
//   readonly platform?: NodeJS.Platform | readonly NodeJS.Platform[];
//   readonly knownProblem?: ValueByPlatform;
// }

export interface GoldenEntryInput
  extends GoldenSnapshotBase<GoldenEntryElement> {
  readonly platform?: NodeJS.Platform | readonly NodeJS.Platform[];
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
  //readonly children?: readonly Snapshot[];
  readonly children?: readonly GoldenSnapshot[];
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
    platform: NodeJS.Platform,
    parentFullName?: string
  ): GoldenSnapshot {
    const resolvedValue = this.resolveForPlatform(cfg.value, platform);
    const resolvedProblem = this.resolveForPlatform(cfg.knownProblem, platform);

    const isFullyQualified = (name: string): boolean => name.includes('.');

    // If this node has a parent, its name must be relative (no dots).
    // This enforces the rule that golden children are written as "[x]", "[size]", etc.
    if (
      parentFullName &&
      parentFullName.length > 0 &&
      isFullyQualified(cfg.name)
    ) {
      throw new Error(
        `[natvis.golden] Child name must be relative under '${parentFullName}', got '${cfg.name}'. ` +
          `Use '${cfg.name.slice(cfg.name.lastIndexOf('.') + 1)}' or the intended relative segment (e.g. "[size]").`
      );
    }

    const fullName =
      parentFullName && parentFullName.length > 0
        ? `${parentFullName}.${cfg.name}`
        : cfg.name;

    const childSnaps =
      cfg.children && cfg.children.length
        ? cfg.children.map((child) =>
            this.materializeTree(child, platform, fullName)
          )
        : undefined;

    return {
      name: fullName,
      ...(cfg.type ? { type: cfg.type } : {}),
      ...(resolvedValue !== undefined ? { value: resolvedValue } : {}),
      ...(resolvedProblem !== undefined
        ? { knownProblem: resolvedProblem }
        : {}),
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

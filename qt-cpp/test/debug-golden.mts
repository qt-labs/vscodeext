// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs/promises';
import * as path from 'path';

const GOLDEN_FILE_NAME = 'expected.locals.json';

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

export type SnapVar = {
  name?: string | undefined;
  type?: string | undefined;
  value?: string | undefined;
  children?: SnapVar[] | undefined;
};

/**
 * Describes a NatVis type that is known to be broken or unstable.
 *
 * - `type`: the Qt type name reported by the debugger (e.g. "QStringView").
 * - `description`: short human description of the known issue.
 * - `variableNames` (optional): restrict the problem to specific variable
 *   names (e.g. only "coreTypes.qStringView"). If omitted, problem applies
 *   to *all* variables of that type.
 */
export interface KnownNatvisProblem {
  readonly type: string;
  readonly description: string;
  readonly variableNames?: readonly string[];
  /**
   * Optional platform restriction.
   *
   * - If omitted → applies to all platforms.
   * - If a single value → applies only to that platform.
   * - If an array → applies to any of those platforms.
   */
  readonly platform?: NodeJS.Platform | readonly NodeJS.Platform[];
}
/**
 * Central registry of known NatVis issues.
 *
 * These types:
 *   - DO NOT cause the test to fail when they differ from golden.
 *   - ARE still compared and recorded.
 *   - Emit diagnostics in debug mode.
 *
 * If a known-problem type starts matching golden again, we log a
 * "seems fixed" message so you can remove it from this list.
 */
export const knownNatvisProblems: readonly KnownNatvisProblem[] = [
  {
    type: 'QStringView',
    description:
      'LLDB currently fails to evaluate {m_data,[m_size]} and prints an evaluation error instead of the string contents.',
    // variableNames: ['coreTypes.qStringView'], // optional filter if needed
    platform: ['darwin', 'linux']
  },
  {
    type: 'QDate',
    description:
      'LLDB fails to evaluate QDate intrinsics (year(), month(), day()) and prints evaluation errors instead of the formatted date.',
    platform: ['darwin', 'linux']
  },
  {
    type: 'QDateTime',
    description:
      'QDateTime NatVis fails differently by platform: ' +
      '- macOS/Linux: NatVis expressions reference Windows-only private symbols ' +
      '(e.g. Qt6Cored.dll!QDateTimePrivate), so LLDB/GDB cannot evaluate the intrinsics ' +
      '(priv(), status(), year(), month(), day(), RecZone views), producing long evaluation errors. ' +
      '- Windows CI: NatVis loads, but required private symbols/fields are not available ' +
      '(Qt build lacks full private debug info), so DisplayString evaluation fails and the debugger ' +
      'falls back to a raw "{d={...}}" representation instead of a formatted date-time.',
    variableNames: [
      'coreTypes.qDateTimeBrunei',
      'coreTypes.qDateTimeDefault',
      'coreTypes.qDateTimeMarquesas',
      'coreTypes.qDateTimeSecOffset',
      'coreTypes.qDateTimeSouthPole',
      'coreTypes.qDateTimeUtc',
      'coreTypes.qDateTimeYukon'
    ],
    platform: ['darwin', 'linux', 'win32']
  },
  {
    type: 'QDateTime',
    description:
      'qDateTimeShouldFail is intentionally constructed with an invalid/timezone setup to ' +
      'exercise QDateTime NatVis error-path behaviour. However, because QDateTime NatVis is ' +
      'currently broken globally, we cannot yet assert its DisplayString or error formatting.',
    variableNames: ['coreTypes.qDateTimeShouldFail'],
    platform: ['darwin', 'linux', 'win32']
  },
  {
    type: 'QDir',
    description:
      'QDir NatVis fails differently by platform: ' +
      '- macOS/Linux: natvis expressions reference Windows-only modules (Qt6Core[d].dll), so LLDB/GDB cannot resolve the intrinsic “d()”. ' +
      '- Windows CI: natvis loads, but DisplayString fails due to missing or incompatible private symbols (QDirPrivate) or incomplete PDBs, causing fallback to raw {d_ptr={...}} output.',
    variableNames: ['coreTypes.qDir'],
    platform: ['darwin', 'linux', 'win32']
  },
  {
    type: 'QFile',
    description:
      'QFile NatVis fails differently by platform: ' +
      '- macOS/Linux: natvis expressions depend on Windows-only Qt6Core[d].dll symbols, so LLDB/GDB cannot evaluate “d()”. ' +
      '- Windows CI: natvis is loaded, but DisplayString evaluation fails (likely due to absent private symbols or reduced PDBs), leading to fallback raw formatting.',
    variableNames: ['coreTypes.qFile'],
    platform: ['darwin', 'linux', 'win32']
  },
  {
    type: 'QFileInfo',
    description:
      'QFileInfo NatVis fails differently by platform: ' +
      '- macOS/Linux: natvis rules reference Windows-only Qt6Core[d].dll symbols, so LLDB/GDB cannot compute the “d()” intrinsic. ' +
      '- Windows CI: natvis loads, but DisplayString fails because required private types or fields (QFileInfoPrivate) are not available in the CI Qt build, forcing the debugger to show raw {d_ptr={...}} output.',
    variableNames: ['coreTypes.qFileInfo'],
    platform: ['darwin', 'linux', 'win32']
  },
  {
    type: 'QUrl',
    description:
      'QUrl NatVis fails differently by platform: ' +
      '- macOS/Linux: LLDB/GDB cannot evaluate the pointer-arithmetic intrinsics used to access scheme()/host()/path() relying on MSVC-specific' +
      '- Windows CI: natvis loads, but DisplayString evaluation fails due to missing private QtCore symbols or reduced PDBs, causing fallback to the raw internal form.',
    variableNames: ['coreTypes.qUrl'],
    platform: ['darwin', 'linux', 'win32']
  },
  {
    type: 'QUuid',
    variableNames: ['coreTypes.qUuid'],
    description:
      'QUuid NatVis uses Visual Studio–only format specifiers (Xb/nvoXb) unsupported by LLDB/GDB, causing evaluation errors on macOS/Linux.',
    platform: ['darwin', 'linux']
  },
  {
    type: 'SelectionFlags',
    variableNames: ['coreTypes.qFlags'],
    description:
      'QFlags-based SelectionFlags NatVis rule only works with the Visual Studio debugger; ' +
      'LLDB/GDB fall back to a raw value, so flag names are not shown.',
    platform: ['darwin', 'linux']
  },
  {
    type: 'QJsonDocument',
    variableNames: ['coreTypes.qJsonDocumentEmpty'],
    platform: ['darwin', 'linux'],
    description:
      'QJsonDocument NatVis relies on MSVC-specific internals (d._Mypair._Myval2) and a Qt6Cored.dll private type in Expand; LLDB/GDB cannot evaluate these, so value stays as raw "{...}" on non-Windows.'
  }

  // Add more entries here as you discover issues.
];

/**
 * Normalizes floating-point artifacts produced by GDB/LLDB/cppvsdbg.
 * Converts things like:
 *   5.0999999999999996 → 5.1
 *   4.2000000000000002 → 4.2
 *   3.1415926535897931 → 3.141593
 */
function normalizeFloatsInStruct(raw: string): string {
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
  value = normalizeFloatsInStruct(value);

  // Special case: QChar-style representation
  //    Windows: "99 u'c'"
  //    Other OSes: "99 'c'"
  //    → normalize both to "99 'c'"
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

export function toSnapshot(vars: any[]): SnapVar[] {
  const sorted = [...vars].sort((a, b) => {
    const an = (a.name ?? '').localeCompare(b.name ?? '');
    return an !== 0 ? an : (a.type ?? '').localeCompare(b.type ?? '');
  });

  return sorted.map((v) => {
    // Step 1: get the raw string value
    const rawValue =
      typeof v.value === 'string'
        ? v.value
        : (v.value?.toString?.() ?? undefined);
    // Step 2: normalize per-type (Qt / debugger differences)
    const normalized =
      rawValue !== undefined
        ? normalizeValue(rawValue)
        : undefined;

    const stable =
      typeof normalized === 'string' ? stripUnstable(normalized) : undefined;

    const snap: SnapVar = {
      name: v.name ?? undefined,
      type: v.type ?? undefined,
      value: stable
    };

    // If children are already fetched/populated by the caller, recurse.
    if (v.variablesReference && Array.isArray(v.children)) {
      snap.children = toSnapshot(v.children);
    }

    return snap;
  });
}

/**
 * Read and parse JSON from disk. Returns undefined on any error.
 */
export async function readGolden<T = unknown>(
  projectDir: string
): Promise<T | undefined> {
  const runtime = path.join(projectDir, GOLDEN_FILE_NAME); //getGoldenPaths(projectDir);
  try {
    const txt = await fs.readFile(runtime, 'utf8');
    return JSON.parse(txt) as T;
  } catch {
    return undefined;
  }
}

/**
 * Write pretty-printed JSON to disk, creating parent directories as needed.
 */
export async function writeGolden(snapshot: unknown): Promise<void> {
  console.log(
    '[natvis.test] writing golden snapshot without checkout out dir...'
  );
  const source = path.join(
    __dirname,
    '../../../test/projectFolderNatvis',
    GOLDEN_FILE_NAME
  );
  console.log('[natvis.test] source golden path:', source);
  const data = JSON.stringify(snapshot, null, 2) + '\n';

  // If updating is requested, also update the canonical source in the repo
  if (
    process.env.UPDATE_NATVIS_GOLDEN === '1' ||
    process.env.UPDATE_NATVIS_GOLDEN?.toLowerCase() === 'true'
  ) {
    await fs.writeFile(source, data, 'utf8');
  }
}

/**
 * Collect a set of type names found in a snapshot tree (including children).
 * Used to compute NatVis coverage warnings.
 */
export function collectTypesFromSnapshot(s: SnapVar[]): Set<string> {
  const out = new Set<string>();
  const visit = (xs: SnapVar[]) => {
    for (const v of xs) {
      if (v.type) out.add(v.type);
      if (v.children) visit(v.children);
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

type NatvisTypes = {
  all: Set<string>;
  bases: Set<string>;
  alts: Map<string, Set<string>>;
};

/**
 * Parse NatVis file and extract all <Type Name="..."> entries (or alternate type).
 * This is a fast, regex-based approximation sufficient for coverage warnings.
 */
export async function parseNatvisTypesWithAlternatives(
  natvisPath: string
): Promise<NatvisTypes> {
  const all = new Set<string>();
  const bases = new Set<string>();
  const alts = new Map<string, Set<string>>();

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
        const set = alts.get(base) ?? new Set<string>();
        set.add(alt);
        alts.set(base, set);
      }
    }

    // Also catch any stray AlternativeType outside blocks (rare)
    const strayAltRe = /<\s*AlternativeType\b[^>]*\bName\s*=\s*"([^"]+)"/g;
    while ((m = strayAltRe.exec(withoutComments))) {
      const rawAlt = m?.[1];
      if (!rawAlt) continue;
      const alt = decodeXmlEntities(rawAlt).trim();
      if (alt) all.add(alt);
    }

    return { all, bases, alts };
  } catch {
    return { all, bases, alts };
  }
}

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
const EXTRA_NATVIS_TYPE_ALIASES: Record<string, string[]> = {
  // NatVis pattern       // Snapshot types to treat as covered by that pattern
  'QFlags<*>': ['SelectionFlags']
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

/**
 * Per-platform value selector for a single variable.
 *
 * - all   → default for every platform, unless overridden
 * - darwin / linux / win32 → override for that specific platform
 */
export interface GoldenValueByPlatform {
  readonly all?: string;
  readonly darwin?: string;
  readonly linux?: string;
  readonly win32?: string;
}

/**
 * Logical description of a golden entry (one Local variable or child).
 *
 * - name      → dotted debugger name, e.g. "coreTypes.qRect" or "containerTypes.qPairStringInt.first"
 * - type      → debugger type name, e.g. "QRect"
 * - value     → either a single string (same everywhere), or per-platform values
 * - platform  → if present, this *entire* entry only exists on those platforms
 * - children  → nested golden entries for expanded children (ready for later)
 */
export interface GoldenEntryBase {
  readonly name: string;
  readonly type?: string;
  readonly value?: string | GoldenValueByPlatform;
  readonly platform?: NodeJS.Platform | readonly NodeJS.Platform[];
  readonly children?: readonly GoldenEntryBase[];
}

type PlatformTag = NodeJS.Platform | readonly NodeJS.Platform[] | undefined;

/**
 * Does this tag apply to the given platform?
 *
 * - undefined → applies everywhere
 * - string    → only that platform
 * - array     → any of those platforms
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

/**
 * GoldenEntry
 *
 * This class represents a *fully materialized logical golden entry*:
 *   - it receives a GoldenEntryBase (the human-edited shape),
 *   - normalizes it,
 *   - and later converts it into a SnapVar for a specific platform.
 *
 * We DO NOT `implements GoldenEntryBase` because:
 *   - exactOptionalPropertyTypes=true makes interfaces with optional fields
 *     (`type?: string`) incompatible with class fields typed as
 *     `string | undefined`.
 *   - It’s simpler and safer to accept GoldenEntryBase in the constructor and
 *     internally maintain the normalized representation.
 */
export class GoldenEntry {
  /** Fully-qualified variable name (e.g. "coreTypes.qRect") */
  readonly name: string;

  /**
   * Optional type name.
   *
   * We store this as `string | undefined`, not as an optional field, so the
   * class has a stable internal shape.
   */
  readonly type: string | undefined;

  /**
   * Value specification:
   *   - A single string → same value for all platforms.
   *   - A GoldenValueByPlatform → per-OS overrides.
   *   - undefined → this entry does not check a value at all.
   */
  readonly value: string | GoldenValueByPlatform | undefined;

  /**
   * Platform restriction for the entire entry:
   *   - undefined → entry exists on all platforms
   *   - "darwin"  → exists only on macOS
   *   - ["linux","win32"] → exists only on Linux & Windows
   */
  readonly platform:
    | NodeJS.Platform
    | readonly NodeJS.Platform[]
    | undefined;

  /**
   * Child entries (nested golden entries for Expand logic).
   *
   * Stored as GoldenEntry[] so transformation logic stays uniform.
   * The array itself is readonly to prevent mutation after construction.
   */
  readonly children: readonly GoldenEntry[] | undefined;

  /**
   * Construct a GoldenEntry from a GoldenEntryBase.
   * We normalize the shape so everything downstream becomes simpler.
   */
  constructor(init: GoldenEntryBase) {
    this.name = init.name;
    this.type = init.type;
    this.value = init.value;
    this.platform = init.platform;

    // Convert any GoldenEntryBase children into proper GoldenEntry instances.
    this.children = init.children
      ? init.children.map((c) => new GoldenEntry(c))
      : undefined;
  }

  /**
   * Resolve the correct value for a specific platform.
   *
   * Precedence:
   *   1) platform-specific override (darwin/linux/win32)
   *   2) all
   *   3) undefined (meaning this golden entry makes no value assertion)
   */
  private resolveValueForPlatform(
    platform: NodeJS.Platform
  ): string | undefined {
    const spec = this.value;

    if (spec === undefined) {
      return undefined; // no value assertion
    }

    if (typeof spec === "string") {
      return spec; // same on all platforms
    }

    // Per-platform overrides
    switch (platform) {
      case "darwin":
        return spec.darwin ?? spec.all;
      case "linux":
        return spec.linux ?? spec.all;
      case "win32":
        return spec.win32 ?? spec.all;
      default:
        // Should not happen, but fallback to "all"
        return spec.all;
    }
  }

  /**
   * Convert this golden entry into a SnapVar for the given platform.
   *
   * Returns:
   *   - SnapVar if this entry applies on the platform
   *   - undefined if the entry is excluded by its platform tag
   */
  toSnapVar(platform: NodeJS.Platform): SnapVar | undefined {
    // Skip if whole entry restricted away
    if (!matchesPlatformTag(this.platform, platform)) {
      return undefined;
    }

    const resolvedValue = this.resolveValueForPlatform(platform);

    // Recursively materialize children
    const childrenSnap = this.children
      ?.map((child) => child.toSnapVar(platform))
      .filter((v): v is SnapVar => Boolean(v));

    // Build SnapVar
    const snap: SnapVar = {
      name: this.name,
      ...(this.type ? { type: this.type } : {}),
      ...(resolvedValue !== undefined ? { value: resolvedValue } : {}),
      ...(childrenSnap && childrenSnap.length
        ? { children: sortSnapshotEntries(childrenSnap) }
        : {}),
    };

    return snap;
  }
}
/**
 * Sort snapshot entries in a stable way:
 *   1) by name (lexicographically)
 *   2) then by type
 * Children are *not* automatically sorted here; callers may sort them too.
 */
export function sortSnapshotEntries<
  T extends { name?: string | undefined; type?: string | undefined }
>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => {
    const an = (a.name ?? '').localeCompare(b.name ?? '');
    if (an !== 0) {
      return an;
    }
    return (a.type ?? '').localeCompare(b.type ?? '');
  });
}

/**
 * Public entry point: given a list of GoldenEntry (your curated list),
 * materialize a SnapVar[] for the current platform, sorted in a stable way.
 *
 * Later the test will do:
 *   const golden = materializeGoldenSnapshot(GOLDEN_ENTRIES, process.platform);
 */
export function materializeGoldenSnapshot(
  entries: readonly GoldenEntry[],
  platform: NodeJS.Platform
): SnapVar[] {
  const snaps = entries
    .map((e) => e.toSnapVar(platform))
    .filter((v): v is SnapVar => Boolean(v));

  // Top-level sort; children are sorted in toSnapVar
  return sortSnapshotEntries(snaps);
}
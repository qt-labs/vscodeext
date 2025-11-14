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
 * Normalize debugger-specific value representations (cross-platform).
 *
 * The same Qt NatVis description produces different string formats depending on
 * the debugger backend:
 *
 *   • Windows (cppvsdbg):      0x123ABC u"Hello World!"
 *   • macOS LLDB (cppdbg):     "Hello World!"
 *   • Linux GDB (cppdbg):      0x123ABC "Hello World!"
 *
 * These differences are NOT due to NatVis itself but due to differences in:
 *   – MI/Lldb/VSDbg value formatting
 *   – pointer prefix printing
 *   – encoding prefixes (u"…")
 *   – QByteArray quoting rules
 *
 * Our golden files must remain debugger-agnostic, so we collapse these backend
 * differences into a single canonical representation:
 *
 *   • All pointer prefixes normalized to   "0xADDR "
 *   • Leading pointer prefixes stripped for QString/QByteArray
 *   • u"…" -> "…"   (drop encoding marker)
 *   • QByteArray values normalized to exactly:  "Hello World!"
 *   • QString values normalized to exactly:     "Hello World!"
 *
 * Only *actual* NatVis-derived content is preserved. Backend noise is removed.
 *
 * IMPORTANT:
 *   – This normalization occurs inside `toSnapshot()`, so golden files and
 *     comparisons are always stable across Windows, macOS, and Linux.
 *   – This function must remain narrow: normalize debugger noise only.
 *     Do NOT normalize NatVis logic (that is what the golden verifies).
 */
/**
 * Convert raw DAP variables into a sorted, minimal, stable snapshot:
 * - Sorted deterministically by name then type
 * - Values normalized via stripUnstable
 * - Optional recursion into children if the array is already populated
 */
/**
 * Normalize debugger values for cross-platform comparison.
 *
 * For QString / QByteArray we:
 *  - Strip leading pointer/address (0x..., 0xADDR, quoted or not)
 *  - Extract the last quoted payload -> "Hello World!"
 *  - Enforce clean quotes
 *
 * For all other types we only normalize the leading pointer prefix.
 */
export function normalizeValue(type: string | undefined, raw: string): string {
  let value = raw.trim();

  const isQtStringLike = type === 'QString' || type === 'QByteArray';

  if (!isQtStringLike) {
    // Non-Qt types: just normalize pointer prefix, let stripUnstable do the rest.
    return value
      .replace(/^0x[0-9A-Fa-f]+(\s+)?/, '0xADDR ')
      .replace(/^0xADDR\s+/, '0xADDR ');
  }

  // ---------- QString / QByteArray normalization ----------

  // 1) If the whole thing is quoted, drop the leading quote
  //    so we can match pointer prefixes like 0x... or 0xADDR.
  if (value.startsWith('"')) {
    value = value.slice(1);
  }

  // 2) Strip pointer-like prefixes (quoted or not):
  //    0x1234..., 0xADDR, with optional spaces.
  value = value.replace(/^0x[0-9A-Fa-f]+(\s+)?/, '');
  value = value.replace(/^0xADDR(\s+)?/, '');
  value = value.trim();

  // Now typical forms look like:
  //   "Hello World!""          (lldb double-quote tail)
  //   u"Hello World!""         (lldb, with u-prefix)
  //   "Hello World!"           (gdb/msvc)
  //   Hello World!

  // 3) Extract the last quoted string, ignoring optional leading 'u'.
  const quoted = value.match(/u?"([^"]*)"\s*"?$/);
  if (quoted) {
    return `"${quoted[1]}"`;
  }

  // 4) Fallback: if no quotes detected, just wrap what remains.
  if (!value.startsWith('"')) {
    value = `"${value}"`;
  }
  // Collapse Windows/MSVC trailing double quote:
  //   "Hello World!""  -> "Hello World!"
  value = value.replace(/""$/, '"');

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
        ? normalizeValue(v.type as string | undefined, rawValue)
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
export async function writeGolden(
  //projectDir: string,
  snapshot: unknown
): Promise<void> {
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

  return { missing: missing.sort(), coveredTypes };
}

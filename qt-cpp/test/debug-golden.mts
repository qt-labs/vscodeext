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

  // 1) Strip leading pointer-like prefixes, with optional opening quote:
  //    "0x1234 "Hello World!""  or  0x1234 "Hello World!"
  value = value.replace(/^"?(0x[0-9A-Fa-f]+|0xADDR)\s*/u, '');
  value = value.trim();

  // 2) Normalize floating-point artifacts everywhere (QRectF, QSizeF, etc.)
  value = normalizeFloatsInStruct(value);

  // 3) If there is a final quoted payload (optional leading 'u'), extract it:
  //
  //    u"Hello World!""   -> Hello World!
  //    "Hello World!""    -> Hello World!
  //    "Hello World!"     -> Hello World!
  //
  const quoted = value.match(/u?"([^"]*)"\s*"?$/u);
  if (quoted && quoted[1] !== undefined) {
    return quoted[1];
  }

  // 4) Fallbacks for simpler fully-quoted forms, just in case:
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
      rawValue !== undefined ? normalizeValue(rawValue) : undefined;

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

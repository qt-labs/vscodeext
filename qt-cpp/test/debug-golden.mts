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
  name?: string;
  type?: string;
  value?: string;
  children?: SnapVar[];
};

/**
 * Convert raw DAP variables into a sorted, minimal, stable snapshot:
 * - Sorted deterministically by name then type
 * - Values normalized via stripUnstable
 * - Optional recursion into children if the array is already populated
 */
export function toSnapshot(vars: any[]): SnapVar[] {
  const sorted = [...vars].sort((a, b) => {
    const an = (a.name ?? '').localeCompare(b.name ?? '');
    return an !== 0 ? an : (a.type ?? '').localeCompare(b.type ?? '');
  });

  return sorted.map((v) => {
    const snap: SnapVar = {
      name: v.name ?? undefined,
      type: v.type ?? undefined,
      value:
        typeof v.value === 'string'
          ? stripUnstable(v.value)
          : (v.value?.toString?.() ?? undefined)
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
  const runtime = path.join(projectDir, GOLDEN_FILE_NAME);//getGoldenPaths(projectDir);
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
  console.log('[natvis.test] writing golden snapshot without checkout out dir...');
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

/**
 * Parse NatVis file and extract all <Type Name="..."> entries.
 * This is a fast, regex-based approximation sufficient for coverage warnings.
 */
export async function parseNatvisTypes(
  natvisPath: string
): Promise<Set<string>> {
  try {
    const xml = await fs.readFile(natvisPath, 'utf8');
    const re = /<\s*Type\b[^>]*\bName\s*=\s*"([^"]+)"/g;
    const types = new Set<string>();

    for (let m: RegExpExecArray | null; (m = re.exec(xml)); ) {
      const name = m[1];
      if (typeof name === 'string' && name.length > 0) {
        // Names can include wildcard patterns like QVector<*>
        types.add(name);
      }
    }
    return types;
  } catch {
    return new Set();
  }
}

/**
 * Given NatVis type patterns and the set of types seen in the snapshot,
 * return the list of NatVis patterns with no matching seen type.
 * Very light wildcard support: '*' -> '.*' anchored full-match.
 */
export function matchNatvisTypePatterns(
  natvisTypes: Set<string>,
  seenTypes: Set<string>
): { missing: string[] } {
  const seen = [...seenTypes];
  const covered = new Set<string>();

  for (const pat of natvisTypes) {
    const rx = new RegExp(
      '^' +
        pat
          // escape regex, then turn \* into .*
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          .replace(/\\\*/g, '.*') +
        '$'
    );
    for (const t of seen) if (rx.test(t)) covered.add(pat);
  }

  const missing = [...natvisTypes].filter((p) => !covered.has(p));
  return { missing: missing.sort() };
}

// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { delay } from '../src/util.js';

/** Let VS Code flush microtasks (useful between command execution and assertions). */
export async function waitForVSCodeIdle(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * Ensure the qt-cpp extension is activated.
 * Throws if it isn't found (helps fail fast in tests).
 */
export async function activateQtCpp(): Promise<void> {
  const ext = vscode.extensions.getExtension('theqtcompany.qt-cpp');
  if (!ext) throw new Error('qt-cpp extension not found');
  if (!ext.isActive) await ext.activate();
}

/**
 * Ensure the qt-core extension is activated.
 * Throws if it isn't found (helps fail fast in tests).
 */
export async function activateQtCore(): Promise<void> {
  const ext = vscode.extensions.getExtension('theqtcompany.qt-core');
  if (!ext) {
    throw new Error('qt-core extension not found');
  }
  if (!ext.isActive) {
    await ext.activate();
  }
}

/**
 * Ensure the qt-qml extension is activated.
 * Throws if it isn't found (helps fail fast in tests).
 */
export async function activateQtQml(): Promise<void> {
  const ext = vscode.extensions.getExtension('theqtcompany.qt-qml');
  if (!ext) {
    throw new Error('qt-qml extension not found');
  }
  if (!ext.isActive) {
    await ext.activate();
  }
}

/**
 * Ensures that the CMake Tools extension is activated before tests run.
 */
export async function activateCMakeTools(): Promise<void> {
  const ext = vscode.extensions.getExtension('ms-vscode.cmake-tools');
  if (!ext) {
    throw new Error('CMake Tools not found (ms-vscode.cmake-tools)');
  }
  if (!ext.isActive) {
    await ext.activate();
    // small delay to allow command registration to settle
    await delay(200);
  }
}

type ResolveResult = {
  /** Leaf toolchain dir (contains bin/, lib/, lib/cmake/Qt6/Qt6Config.cmake) */
  leaf: string;
  /** Version actually used, e.g. "6.9.0" */
  version: string;
  /** Where the version decision came from */
  source: 'env-QT_VERSION_FOR_TEST' | 'default-6.9.0' | 'fallback-lower';
  /** Args to pass to CMake configure() */
  cmakeArgs: string[];
};

/**
 * Return true if <prefix>/lib/cmake/Qt6/Qt6Config.cmake exists.
 */
function hasQt6Config(prefix: string): boolean {
  const p = path.join(prefix, 'lib', 'cmake', 'Qt6', 'Qt6Config.cmake');
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

/** Compare "6.10.0" > "6.9.0" > "6.8.2" … descending. */
function cmpQtVersionsDesc(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10));
  const pb = b.split('.').map((n) => Number.parseInt(n, 10));
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return db - da; // larger first
  }
  return 0;
}

/** Collect all installed Qt versions under <top> for both layouts. */
function listInstalledVersions(top: string): string[] {
  const seen = new Set<string>();
  const tryDir = (base: string) => {
    try {
      for (const d of fs.readdirSync(base, { withFileTypes: true })) {
        if (d.isDirectory() && /^6\.\d+(\.\d+)?$/.test(d.name))
          seen.add(d.name);
      }
    } catch {
      /* ignore */
    }
  };
  tryDir(top); // <top>/<ver> (local)
  tryDir(path.join(top, 'Qt')); // <top>/Qt/<ver> (CI)
  return Array.from(seen).sort(cmpQtVersionsDesc);
}

/**
 * Find a *leaf* under a concrete version. Works with:
 * - <top>/<ver>/<arch>
 * - <top>/Qt/<ver>/<arch>
 * Scans all subdirs of the version to find one with Qt6Config.cmake.
 */
function findLeafForVersion(top: string, version: string): string | null {
  const toScan = [path.join(top, version), path.join(top, 'Qt', version)];
  for (const base of toScan) {
    let subs: string[] = [];
    try {
      subs = fs
        .readdirSync(base, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => path.join(base, d.name));
    } catch {
      /* ignore */
    }
    // Prefer common arch names first, then anything:
    const preferredFirst = [
      ...subs.filter((s) =>
        /(?:^|\/)(macos|clang_64|gcc_64|mingw_64|msvc20\d{2}_64)$/.test(s)
      ),
      ...subs.filter(
        (s) =>
          !/(?:^|\/)(macos|clang_64|gcc_64|mingw_64|msvc20\d{2}_64)$/.test(s)
      )
    ];
    for (const cand of preferredFirst) {
      if (hasQt6Config(cand)) return cand;
    }
  }
  return null;
}

/**
 * Resolve Qt by version policy and set ONLY Qt6_DIR.
 * Policy:
 *   1) Use QT_VERSION_FOR_TEST if present and installed.
 *   2) Else use defaultVersion (defaults to "6.9.0") if installed.
 *   3) Else use the closest LOWER installed version.
 * Prints what it chose and returns -D args with ONLY -DQt6_DIR=...
 */
export function prepareCMakeQtEnvWithVersion(opts?: {
  topLevel?: string; // Defaults to process.env.QT_TEST_QT_ROOT
  defaultVersion?: string; // Defaults to "6.9.0"
  verbose?: boolean; // Defaults to true
}): ResolveResult {
  const top = opts?.topLevel ?? process.env.QT_TEST_QT_ROOT ?? '';
  const defaultVersion = opts?.defaultVersion ?? '6.9.0';
  const verbose = opts?.verbose ?? true;

  const logs: string[] = [];
  logs.push(`[qt-test] QT_TEST_QT_ROOT='${top || '<unset>'}'`);
  logs.push(
    `[qt-test] QT_VERSION_FOR_TEST='${process.env.QT_VERSION_FOR_TEST ?? '<unset>'}'`
  );
  logs.push(`[qt-test] (ignoring CMAKE_PREFIX_PATH entirely)`);

  const versions = listInstalledVersions(top);
  if (versions.length === 0) {
    const msg = `[qt-test] ERROR: No Qt versions found under '${top || '<unset>'}'. Install Qt dev files.`;
    logs.push(msg);
    if (verbose) logs.forEach((l) => console.log(l));
    throw new Error(msg);
  }

  const finalize = (
    leaf: string,
    version: string,
    source: ResolveResult['source']
  ): ResolveResult => {
    const qt6Dir = path.join(leaf, 'lib', 'cmake', 'Qt6');
    process.env.Qt6_DIR = qt6Dir; // <-- the only knob we set

    logs.push(`[qt-test] Using Qt ${version} (${source})`);
    logs.push(`[qt-test] leaf='${leaf}'`);
    logs.push(`[qt-test] Qt6_DIR='${qt6Dir}'`);
    if (verbose) logs.forEach((l) => console.log(l));

    return { leaf, version, source, cmakeArgs: [`-DQt6_DIR=${qt6Dir}`] };
  };

  // 1) Respect explicit request
  const wanted = process.env.QT_VERSION_FOR_TEST;
  if (wanted) {
    const leaf = findLeafForVersion(top, wanted);
    if (leaf) return finalize(leaf, wanted, 'env-QT_VERSION_FOR_TEST');
    logs.push(
      `[qt-test] WARNING: Requested Qt ${wanted} not found under '${top}'.`
    );
  }

  // 2) Default version
  const defLeaf = findLeafForVersion(top, defaultVersion);
  if (defLeaf) return finalize(defLeaf, defaultVersion, 'default-6.9.0');

  // 3) Closest lower installed version
  const basis = wanted ?? defaultVersion;
  const lower = versions
    .filter((v) => cmpQtVersionsDesc(v, basis) > 0) // v < basis
    .sort(cmpQtVersionsDesc);

  for (const v of lower) {
    const lf = findLeafForVersion(top, v);
    if (lf) return finalize(lf, v, 'fallback-lower');
  }

  const msg =
    `[qt-test] ERROR: Could not find Qt ${wanted ?? defaultVersion} or any lower version under '${top}'. ` +
    `Found versions: ${versions.join(', ') || '<none>'}`;
  logs.push(msg);
  if (verbose) logs.forEach((l) => console.log(l));
  throw new Error(msg);
}

export function getWorkspaceFolderOrThrow(): vscode.WorkspaceFolder {
  const ws = vscode.workspace.workspaceFolders?.[0];
  if (!ws)
    throw new Error('No workspace folder open — expected project folder.');
  return ws;
}

export async function cleanBuildDir(
  projectDir: string,
  subdir = 'build'
): Promise<string> {
  const buildDir = path.join(projectDir, subdir);
  await fs.promises
    .rm(buildDir, { recursive: true, force: true })
    .catch(() => {});
  return buildDir;
}

export class CMakeConfigurator {
  private ws: vscode.WorkspaceFolder;
  private resetValues: Map<string, unknown> = new Map();

  constructor(ws: vscode.WorkspaceFolder) {
    this.ws = ws;
  }

  async set(
    settingName: string,
    value: unknown,
    resetValue?: unknown
  ): Promise<void> {
    if (!this.resetValues.has(settingName)) {
      this.resetValues.set(settingName, resetValue);
    }
    await vscode.workspace
      .getConfiguration('cmake', this.ws.uri)
      .update(settingName, value, vscode.ConfigurationTarget.Workspace);
  }
  resetAll() {
    const resets: Promise<void>[] = [];
    for (const [settingName, value] of this.resetValues.entries()) {
      resets.push(
        Promise.resolve(
          vscode.workspace
            .getConfiguration('cmake', this.ws.uri)
            .update(settingName, value, vscode.ConfigurationTarget.Workspace)
        )
      );
    }
    this.resetValues.clear();
    return Promise.all(resets);
  }
}

export function cmakeConfigForWorkspace(ws: vscode.WorkspaceFolder) {
  return new CMakeConfigurator(ws);
}

/**
 * Reads a specific variable value from a CMake build directory's `CMakeCache.txt` file.
 *
 * The function searches the cache file for a line starting with `<name>:` and returns
 * the value after the equals sign (`=`). This is useful in tests to confirm which
 * configuration variables (e.g. `Qt6_DIR`, `CMAKE_PREFIX_PATH`) CMake actually used
 * during `cmake.configure()`.
 *
 * Example line in `CMakeCache.txt`:
 * ```
 * Qt6_DIR:PATH=/Users/alice/Qt/6.9.0/macos/lib/cmake/Qt6
 * ```
 * Calling `readCMakeCacheVar(buildDir, 'Qt6_DIR')` would return:
 * ```
 * /Users/alice/Qt/6.9.0/macos/lib/cmake/Qt6
 * ```
 *
 * @param buildDir - Path to the CMake build directory containing `CMakeCache.txt`.
 * @param name - The cache variable name to look for (e.g. `"Qt6_DIR"`).
 * @returns The variable value as a string, or `undefined` if not found or unreadable.
 */
export function readCMakeCacheVar(
  buildDir: string,
  name: string
): string | undefined {
  const cache = path.join(buildDir, 'CMakeCache.txt');
  try {
    const line = fs
      .readFileSync(cache, 'utf8')
      .split(/\r?\n/)
      .find((l) => l.startsWith(`${name}:`));
    return line?.split('=')[1];
  } catch {
    return undefined;
  }
}

export function prepareStandardCMakeArgs(
  debugFlag = process.env.QT_TEST_DEBUG === '1'
): string[] {
  const args = ['-DCMAKE_BUILD_TYPE=Debug'];
  if (debugFlag) args.push('-DCMAKE_FIND_DEBUG_MODE=ON');
  return args;
}

/** :
 *  - Windows:  %USERPROFILE%\AppData\Local\CMakeTools\cmake-tools-kits.json
 *  - Others (incl. macOS): ~/.local/share/CMakeTools/cmake-tools-kits.json
 */
function kitsPath(): string {
  const home = os.homedir();
  if (process.platform === 'win32') {
    return path.join(
      home,
      'AppData',
      'Local',
      'CMakeTools',
      'cmake-tools-kits.json'
    );
  }
  return path.join(
    home,
    '.local',
    'share',
    'CMakeTools',
    'cmake-tools-kits.json'
  );
}

type KitLike = { name?: string; label?: string };

/** Read kits */
function readKitsFromDisk(): KitLike[] {
  const p = kitsPath();
  try {
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as KitLike[];
    }
  } catch {
    // ignore; fall through to empty
  }
  return [];
}

/**
 * Selects the most appropriate CMake Kit name from a given list.
 *
 * The selection logic follows platform-specific compiler preferences:
 *  - **macOS:** prefers Clang (arm64 or AppleClang), then generic Clang, then GCC.
 *  - **Windows:** prefers MSVC / Visual Studio / Clang-cl, then Clang, then MinGW/GCC.
 *  - **Linux/other:** prefers GCC, then Clang.
 *
 * If no kit matches these patterns, the first available kit is returned as a fallback.
 *
 * @param list - Array of kits (each with an optional `name` or `label`).
 * @returns The chosen kit name or `undefined` if no kits are available.
 */
function pickKit(list: KitLike[]): string | undefined {
  if (!Array.isArray(list) || list.length === 0) return undefined;

  const preferences: RegExp[] =
    process.platform === 'darwin'
      ? [/Clang.*arm64/i, /AppleClang/i, /Clang/i, /GCC/i]
      : process.platform === 'win32'
        ? [/MSVC|Visual Studio|Clang-cl/i, /Clang/i, /GCC|MinGW/i]
        : [/GCC/i, /Clang/i];

  for (const re of preferences) {
    const k = list.find((kk) => re.test(kk.name ?? kk.label ?? ''));
    if (k) return k.name ?? k.label;
  }
  const first = list[0];
  return first ? (first.name ?? first.label) : undefined;
}

/**
 * Performs non-interactive CMake Kit selection using the same logic
 * as the original (pre-refactor) build test.
 *
 * Steps:
 *  1. Runs the `cmake.scanForKits` command to refresh available kits.
 *  2. Reads the kits file from disk (`cmake-tools-kits.json`) in the
 *     standard CMake Tools location for the current platform.
 *  3. Chooses the best matching kit using {@link pickKit} preferences.
 *  4. Applies the kit via `cmake.setKitByName` and waits briefly for
 *     CMake Tools to update its state.
 *
 * This function reproduces exactly the same behavior used before the
 * test helper refactor — ensuring consistent results across platforms
 * without user prompts.
 *
 * @returns The selected kit name, or `undefined` if no kit was found.
 */
export async function selectAndApplyKit(): Promise<string | undefined> {
  await vscode.commands.executeCommand('cmake.scanForKits');

  const kits = readKitsFromDisk();

  const kitName = pickKit(kits);

  if (kitName) {
    await vscode.commands.executeCommand('cmake.setKitByName', kitName);
    await waitForVSCodeIdle();
    console.log('[build.test] Selected Kit:', kitName);
  } else {
    console.warn('[build.test] No kitName resolved; configure may prompt.');
  }

  return kitName;
}

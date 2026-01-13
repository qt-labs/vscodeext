// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

// Minimal helpers to discover, pick, and apply a Qt kit for CMake Tools.

import * as fs from 'fs';
import * as path from 'path';
//import * as os from 'os';
import * as vscode from 'vscode';

type KitLike = {
  name?: string; // CMake Tools kit name
  qtVersionMajor?: number;
  label?: string; // sometimes used instead of name
  toolchainFile?: string; // Qt6 toolchain path -> strong Qt signal
  environmentVariables?: Record<string, string | undefined>; // VSCODE_QT_INSTALLATION, etc.
};

function hasAnyQtKit(kits: KitLike[]): boolean {
  return kits.some(isQtKit);
}
/** Call the qt-cpp scan and then select+apply a Qt kit. Returns the chosen kit name or undefined. */
export async function selectAndApplyQtKit(
  wsFolder?: vscode.WorkspaceFolder,
  requiredQtMajor?: number
): Promise<string | undefined> {
  // Read kits from disk (workspace and global)
  let kits = readQtKitsFromDisk(wsFolder);

  // If nothing Qt-like is present, do one *quiet* refresh, then read again
  if (!hasAnyQtKit(kits)) {
    await vscode.commands.executeCommand('qt-cpp.scanForQtKits');
    kits = readQtKitsFromDisk(wsFolder);
  }

  kits = filterQtKitsByQtTestQtRoot(kits);
  kits = filterQtKitsByQtVersionForTest(kits);
  kits = filterQtKitsForHostDesktop(kits);

  // Filter to Qt kits and pick one appropriate for this machine
  const kitName = pickQtKit(kits);

  // Apply it to CMake Tools (no-op if undefined)
  if (kitName) {
    await vscode.commands.executeCommand('cmake.setKitByName', kitName);
    console.log('[qt-kits-helper] Selected Qt Kit:', kitName);
  } else if (typeof requiredQtMajor === 'number') {
    console.warn(
      `[qt-kits-helper] No Qt${requiredQtMajor} kit found; ` +
        'CMake may prompt interactively or fail later.'
    );
  } else {
    console.warn(
      '[qt-kits-helper] No suitable Qt kit found; CMake may prompt interactively.'
    );
  }

  return kitName;
}

export function filterQtKitsByQtVersionForTest(kits: KitLike[]): KitLike[] {
  const wanted = (process.env.QT_VERSION_FOR_TEST ?? '').trim();
  if (!wanted) return kits;

  // Accept "6", "6.9", "6.9.0", "6.10.1"
  const m = wanted.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/);
  if (!m) return kits;

  const wantMajor = Number(m[1]);
  const wantMinor = m[2] !== undefined ? Number(m[2]) : undefined;
  const wantPatch = m[3] !== undefined ? Number(m[3]) : undefined;

  const parsedFromInstallPath = (
    k: KitLike
  ): { major: number; minor: number; patch: number } | undefined => {
    const inst = k.environmentVariables?.VSCODE_QT_INSTALLATION;
    if (!inst) return undefined;

    // Typical: /Users/lucie/Qt/6.10.1/macos
    const mm = inst.match(/[\/\\](\d+)\.(\d+)\.(\d+)(?:[\/\\]|$)/);
    if (!mm) return undefined;

    return { major: Number(mm[1]), minor: Number(mm[2]), patch: Number(mm[3]) };
  };

  const matchesWanted = (k: KitLike): boolean => {
    // Prefer explicit kit metadata if present
    if (typeof k.qtVersionMajor === 'number' && k.qtVersionMajor !== wantMajor)
      return false;

    const v = parsedFromInstallPath(k);
    if (v) {
      if (v.major !== wantMajor) return false;
      if (wantMinor !== undefined && v.minor !== wantMinor) return false;
      if (wantPatch !== undefined && v.patch !== wantPatch) return false;
      return true;
    }

    // If we only asked for major, and kit has qtVersionMajor, accept it.
    if (
      wantMinor === undefined &&
      wantPatch === undefined &&
      k.qtVersionMajor === wantMajor
    )
      return true;

    // Otherwise we can't verify this kit matches.
    return false;
  };

  const filtered = kits.filter(matchesWanted);

  if (filtered.length === 0) {
    console.warn(
      `[qt-kits-helper] QT_VERSION_FOR_TEST is set (${wanted}) but no kits could be matched ` +
        'via VSCODE_QT_INSTALLATION or qtVersionMajor. Falling back.'
    );
    return kits;
  }

  return filtered;
}

export function filterQtKitsByQtTestQtRoot(kits: KitLike[]): KitLike[] {
  const qtRoot = process.env.QT_TEST_QT_ROOT;
  if (!qtRoot) return kits;

  const root = path.normalize(qtRoot) + path.sep;

  const inQtRoot = (k: KitLike): boolean => {
    const inst = k.environmentVariables?.VSCODE_QT_INSTALLATION;
    if (!inst) return false;
    return path.normalize(inst).startsWith(root);
  };

  const filtered = kits.filter(inQtRoot);

  if (filtered.length === 0) {
    console.warn(
      `[qt-kits-helper] QT_TEST_QT_ROOT is set (${qtRoot}) but no kits had ` +
        'environmentVariables.VSCODE_QT_INSTALLATION under it. Falling back.'
    );
    return kits;
  }

  return filtered;
}

function filterQtKitsForHostDesktop(kits: KitLike[]): KitLike[] {
  const instOf = (k: KitLike): string =>
    path.normalize(k.environmentVariables?.VSCODE_QT_INSTALLATION ?? '');

  const isBadTarget = (p: string): boolean => {
    const s = p.toLowerCase();
    return (
      s.includes(`${path.sep}android_`) ||
      s.includes(`${path.sep}ios`) ||
      s.includes(`${path.sep}wasm_`)
    );
  };

  const isHostDesktop = (p: string): boolean => {
    const s = p.toLowerCase();

    if (process.platform === 'darwin') return s.endsWith(`${path.sep}macos`);
    if (process.platform === 'win32')
      return s.includes(`${path.sep}msvc`) || s.includes(`${path.sep}mingw`);
    // linux
    return s.endsWith(`${path.sep}gcc_64`) || s.endsWith(`${path.sep}clang_64`);
  };

  const filtered = kits.filter((k) => {
    const p = instOf(k);
    if (!p) return false;
    if (isBadTarget(p)) return false;
    return isHostDesktop(p);
  });

  // If nothing matched (layout differs), fall back to just “not bad targets”
  if (filtered.length > 0) return filtered;

  const fallback = kits.filter((k) => {
    const p = instOf(k);
    return p && !isBadTarget(p);
  });

  return fallback.length > 0 ? fallback : kits;
}

/** Determine likely kit file paths (workspace + platform-global). */
function candidateKitsFiles(ws?: vscode.WorkspaceFolder): string[] {
  const files: string[] = [];

  // workspace kits
  if (ws) files.push(path.join(ws.uri.fsPath, '.vscode', 'cmake-kits.json'));
  const home = process.env.HOME ?? process.env.USERPROFILE ?? '';

  // Global CMake Tools (macOS typical)
  if (process.platform === 'darwin') {
    // macOS: ~/Library/Application Support/CMakeTools/cmake-tools-kits.json
    files.push(
      path.join(
        home,
        'Library',
        'Application Support',
        'CMakeTools',
        'cmake-tools-kits.json'
      )
    );
  }

  if (process.platform === 'linux' || process.platform === 'darwin') {
    // Linux / XDG: ~/.local/share/CMakeTools/cmake-tools-kits.json
    files.push(
      path.join(home, '.local', 'share', 'CMakeTools', 'cmake-tools-kits.json')
    );
  }
  // Windows
  if (process.platform === 'win32') {
    // Windows: prefer LOCALAPPDATA (CMake Tools default), fall back to a sane guess.
    const localAppData =
      process.env.LOCALAPPDATA ||
      (home ? path.join(home, 'AppData', 'Local') : '');

    if (localAppData) {
      files.push(
        path.join(localAppData, 'CMakeTools', 'cmake-tools-kits.json')
      );
    }

    // Optional fallback: some older setups might have used APPDATA (Roaming)
    if (process.env.APPDATA) {
      files.push(
        path.join(process.env.APPDATA, 'CMakeTools', 'cmake-tools-kits.json')
      );
    }
  }

  // Dedup + keep existing only
  const seen = new Set<string>();
  const existing = files
    .map((p) => path.normalize(p))
    .filter((p) => !seen.has(p) && (seen.add(p), true))
    .filter((p) => fs.existsSync(p));

  console.log('[qt-kits] checking files:', existing);

  return existing;
}

/** Read Qt kits from typical CMake Tools kit files (workspace first, then global). */
export function readQtKitsFromDisk(ws?: vscode.WorkspaceFolder): KitLike[] {
  const paths = candidateKitsFiles(ws);
  console.log('[qt-kits] checking files:', paths);
  const out: KitLike[] = [];
  for (const p of paths) {
    try {
      const raw = fs.readFileSync(p, 'utf-8');
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        console.log('[qt-kits] loaded', arr.length, 'kits from', p);
        out.push(...arr);
      }
    } catch (e) {
      // ignore one file; continue others
    }
  }
  console.log('[qt-kits] total kits loaded:', out.length);
  return out;
}

/** Heuristic: is a CMake Tools kit a "Qt kit"? */
function isQtKit(k: KitLike): boolean {
  if (!k) return false;
  const nm = (k.name ?? k.label ?? '').toLowerCase();

  // Strong signals:
  if (k.environmentVariables?.VSCODE_QT_INSTALLATION) return true;
  if (
    k.toolchainFile &&
    /[\/\\]Qt6[\/\\]qt\.toolchain\.cmake$/i.test(k.toolchainFile)
  )
    return true;

  // Weak signal: name starts with "Qt " or contains typical tokens
  if (/\bqt\b/i.test(nm)) return true;

  return false;
}

/** Pick the "best" Qt kit for this OS/arch from a list of kits. */
export function pickQtKit(allKits: KitLike[]): string | undefined {
  const qtKits = allKits.filter(isQtKit);
  if (qtKits.length === 0) return undefined;

  const nameFor = (k: KitLike) => k.name ?? k.label ?? '';

  // Arch & platform hints
  const isMac = process.platform === 'darwin';
  const isWin = process.platform === 'win32';
  const isArm64 = process.arch === 'arm64';

  // Prefer native arch in the kit name if present
  const archPrefs: RegExp[] = isArm64
    ? [/arm64|aarch64/i]
    : [/x86_64|x64|amd64/i];

  // Platform-specific compiler/kit preferences
  const compilerPrefs: RegExp[] = isWin
    ? [/MSVC|Visual Studio|Clang-cl/i, /MinGW|GCC/i, /Clang/i]
    : isMac
      ? [/Clang.*arm64/i, /Apple.?Clang/i, /Clang/i, /GCC/i]
      : [/GCC/i, /Clang/i];

  // 1) Try arch match + compiler preference
  for (const arch of archPrefs) {
    for (const comp of compilerPrefs) {
      const found = qtKits.find(
        (k) => arch.test(nameFor(k)) && comp.test(nameFor(k))
      );
      if (found) return nameFor(found);
    }
  }

  // 2) Try compiler preference only
  for (const comp of compilerPrefs) {
    const found = qtKits.find((k) => comp.test(nameFor(k)));
    if (found) return nameFor(found);
  }

  // 3) Fall back to the first Qt kit
  return nameFor(qtKits[0]!);
}

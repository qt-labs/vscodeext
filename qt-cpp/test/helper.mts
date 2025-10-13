// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { isDeepStrictEqual } from 'util';
import { delay } from 'qt-lib';

/**
 * Mocha lifecycle wiring for a shared Sinon sandbox.
 * - creates a sandbox once
 * - (optionally) activates the extension once
 * - resets sandbox before each test
 * - verifies & restores after each test
 */
export function setupSandboxLifecycleHooks(
  assign: (sb: sinon.SinonSandbox) => void,
  activate?: () => Thenable<unknown> | void
): void {
  let sb: sinon.SinonSandbox;

  before('create sandbox', () => {
    sb = sinon.createSandbox();
    assign(sb);
  });

  if (activate) {
    before('activate extension', activate);
  }

  beforeEach('reset sandbox', () => {
    sb = sinon.createSandbox();
    assign(sb);
  });

  afterEach('verify and restore sandbox', () => {
    sb.verifyAndRestore();
  });
}

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
 * Stub `vscode.commands.executeCommand` and record calls that match the provided
 * command + args. Uses Node's deep equal (no lodash-es dependency).
 *
 * Usage:
 *   const spy = stubExecuteCommandWithSpy(sb, ['cmake.scanForKits']);
 *   await vscode.commands.executeCommand('cmake.scanForKits');
 *   expect(spy.calledOnce).to.be.true;
 */
export type CommandArgs = [string, ...unknown[]];
export type CommandInput = CommandArgs | CommandArgs[];

export function stubExecuteCommandWithSpy(
  sb: sinon.SinonSandbox,
  input: CommandInput
): sinon.SinonSpy {
  const real = vscode.commands.executeCommand.bind(vscode.commands);
  const list = Array.isArray(input[0])
    ? (input as CommandArgs[])
    : [input as CommandArgs];
  const spy = sinon.spy();

  sb.stub(vscode.commands, 'executeCommand').callsFake(
    (cmd: string, ...args: unknown[]) => {
      for (const [expectedCmd, ...expectedArgs] of list) {
        if (
          cmd === expectedCmd &&
          expectedArgs.length === args.length &&
          expectedArgs.every((exp, i) => isDeepStrictEqual(exp, args[i]))
        ) {
          spy(cmd, ...args);
          return Promise.resolve();
        }
      }
      return real(cmd, ...args);
    }
  );

  return spy;
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

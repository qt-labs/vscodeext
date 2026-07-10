// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import { delay } from 'qt-lib';

import { selectAndApplyQtKit } from './qt-kits-helper.mts';
import {
  waitForVSCodeIdle,
  getWorkspaceFolderOrThrow,
  cleanBuildDir,
  readCMakeCacheVar,
  dlog
} from './helper.mts';

// ---------------------------------------------------------------------------
// Shared helper: configure + build minimal Qt project and select Qt kit
// ---------------------------------------------------------------------------

/**
 * Result object returned by `configureAndBuildMinimalQtProject`.
 *
 * It represents a fully prepared, successfully built Qt test project
 * that is ready to be debugged.
 *
 * Fields:
 *   - `wsFolder`   : The resolved VS Code workspace folder.
 *   - `projectDir`: Absolute path to the project root on disk.
 *   - `buildDir`  : Absolute path to the CMake build directory used for the test.
 *   - `kit`       : Identifier of the Qt kit selected and applied for this build.
 *   - `errSpy`    : Sinon spy on `vscode.window.showErrorMessage`, used to assert
 *                   that no unexpected user-facing errors occurred during
 *                   configure or build.
 *
 * This type is intentionally narrow and test-oriented:
 * callers should treat it as an immutable snapshot of the build setup
 * rather than as a mutable configuration object.
 */
type ConfigureResult = {
  wsFolder: vscode.WorkspaceFolder;
  projectDir: string;
  buildDir: string;
  kit: string;
  errSpy: sinon.SinonSpy;
};

/**
 * Detect the required Qt **major version** for the test project by inspecting
 * its top-level CMakeLists.txt.
 *
 * The function looks for a `find_package(Qt<major> ...)` invocation, e.g.:
 *
 *   - find_package(Qt6 REQUIRED COMPONENTS Core)
 *   - find_package ( Qt5 CONFIG REQUIRED ... )
 *
 * This is used by NatVis and snippet tests to select a compatible Qt kit
 * before configuring and building the project.
 *
 * Behavior:
 *   - Returns the numeric Qt major version (e.g. 5 or 6) if found.
 *   - Throws a descriptive error if:
 *       • CMakeLists.txt is missing,
 *       • no suitable `find_package(Qt<major> ...)` line is found,
 *       • or the version cannot be parsed.
 *
 * This function intentionally fails fast: without a detectable Qt major,
 * the test cannot reliably select a Qt kit.
 *
 * @param projectDir Absolute path to the test project root.
 * @returns          The required Qt major version (e.g. 5 or 6).
 */
function getRequiredQtMajorFromCMake(projectDir: string): number {
  const cmakeListsPath = path.join(projectDir, 'CMakeLists.txt');

  if (!fs.existsSync(cmakeListsPath)) {
    const message =
      `[natvis.test] CMakeLists.txt not found at ${cmakeListsPath}; ` +
      'cannot detect required Qt major version.';
    throw new Error(message);
  }

  const content = fs.readFileSync(cmakeListsPath, 'utf8');

  // Match e.g.:
  //   find_package(Qt6 REQUIRED COMPONENTS Core)
  //   find_package ( Qt5 CONFIG REQUIRED ... )
  const regex = /find_package\s*\(\s*Qt(\d+)\b[^)]*\)/i;
  const match = regex.exec(content);

  if (!match || !match[1]) {
    const message =
      '[natvis.test] Could not find a line like ' +
      '"find_package(Qt<major> ...)" in CMakeLists.txt; ' +
      'cannot determine required Qt major version.';
    throw new Error(message);
  }

  const majorStr = match[1];
  const major = Number.parseInt(majorStr, 10);

  if (Number.isNaN(major)) {
    const message =
      `[natvis.test] Could not parse Qt major version from '${majorStr}' ` +
      'in CMakeLists.txt.';
    throw new Error(message);
  }

  return major;
}

/**
 * Materialize a platform-specific debug configuration from a snippet-style
 * DebugConfiguration.
 *
 * Qt debug snippets (from package.json) often contain nested platform blocks:
 *
 *   {
 *     "type": "cppdbg",
 *     "linux":   { ... },
 *     "osx":     { ... },
 *     "windows": { ... }
 *   }
 *
 * When VS Code launches a debug session, it automatically merges the
 * current platform block into the root configuration and discards the others.
 *
 * This helper reproduces that behavior explicitly so that:
 *   - snippet-based debug configs can be launched programmatically in tests,
 *   - the resulting configuration matches what the debug service actually sees,
 *   - no `${command:...}` or platform indirections remain unresolved.
 *
 * Behavior:
 *   - Merges the current platform block (`linux`, `osx`, or `windows`) into `base`.
 *   - Removes all nested platform blocks from the result.
 *   - Returns a flat, concrete DebugConfiguration ready for `startDebugging`.
 *
 * @param base  DebugConfiguration taken directly from a debugger snippet.
 * @returns     Platform-resolved DebugConfiguration for the current OS.
 */
export function materializeSnippetConfigForCurrentPlatform(
  base: vscode.DebugConfiguration
): vscode.DebugConfiguration {
  const isWin = process.platform === 'win32';
  const isMac = process.platform === 'darwin';
  const platformKey = isWin ? 'windows' : isMac ? 'osx' : 'linux';

  const platformOverrides = (base as any)[platformKey] as
    | Record<string, unknown>
    | undefined;

  const merged: vscode.DebugConfiguration = {
    ...base,
    ...(platformOverrides ?? {})
  };
  // Once merged, drop the nested platform blocks so we end up with the
  // same shape the debug service would see.
  delete (merged as any).linux;
  delete (merged as any).osx;
  delete (merged as any).windows;

  return merged;
}

/**
 * Configure and build the minimal Qt test project using CMake Tools and
 * the qt-cpp extension, ensuring a valid Qt kit is selected.
 *
 * This helper encapsulates the full **project bring-up phase** required
 * before any NatVis or debugger-based test can run:
 *
 *   - Resolves the workspace folder and cleans the build directory.
 *   - Scans for available Qt kits and selects one matching the Qt major
 *     version required by the project's CMakeLists.txt.
 *   - Runs `cmake.configure` and `cmake.build`, asserting successful results.
 *   - Verifies that the expected build artifact exists on disk.
 *   - Spies on `vscode.window.showErrorMessage` to ensure no unexpected
 *     user-facing errors occurred during configure/build.
 *
 * Test-environment behavior:
 *   - On CI: **fails hard** if no suitable Qt kit is available, so
 *     misconfiguration is immediately visible.
 *   - On local developer machines: **skips the test** cleanly if no
 *     matching Qt kit is found.
 *
 * Design notes:
 *   - All assertions live here so callers can assume a fully built,
 *     ready-to-debug project.
 *   - The Sinon sandbox is passed explicitly to avoid hidden global state
 *     and to integrate cleanly with per-test sandbox lifecycles.
 *
 * @param ctx        Mocha test context, used only to skip the test locally
 *                   when no suitable Qt kit is available.
 * @param logPrefix  Prefix used for debug logging to keep test output readable.
 * @param sandbox    Sinon sandbox used to register spies for this test run.
 *
 * @returns An object containing workspace paths, the selected Qt kit,
 *          the build directory, and the error-message spy.
 *
 * @throws Error on CI if no Qt kit is available, or if configure/build fails.
 */
/**
 * Re-run the CMake build directly and print its full output.
 *
 * `vscode.commands.executeCommand('cmake.build')` only resolves to an exit
 * code; the compiler/linker diagnostics are written to the CMake Tools output
 * channel, which is not forwarded to stdout in the test runner. When a build
 * fails on CI we therefore see only `rc=1` with no explanation.
 *
 * This helper invokes `cmake --build <buildDir>` synchronously against the
 * already-configured build directory and echoes stdout/stderr, so the real
 * error (e.g. a header that does not compile against the toolchain) lands in
 * the CI log right before the assertion fails. Best-effort only: any problem
 * spawning cmake is logged and swallowed so it never masks the original rc.
 */
function dumpBuildOutput(logPrefix: string, buildDir: string): void {
  console.log(
    `${logPrefix} ===== cmake.build failed; re-running build to capture output =====`
  );
  try {
    const res = cp.spawnSync('cmake', ['--build', buildDir], {
      encoding: 'utf-8',
      shell: process.platform === 'win32'
    });
    if (res.error) {
      console.log(
        `${logPrefix} could not spawn cmake --build: ${res.error.message}`
      );
    }
    if (res.stdout) {
      console.log(res.stdout);
    }
    if (res.stderr) {
      console.log(res.stderr);
    }
    console.log(
      `${logPrefix} cmake --build exit code: ${res.status ?? '<none>'}`
    );
  } catch (err) {
    console.log(
      `${logPrefix} failed to capture build output: ${(err as Error).message}`
    );
  }
  console.log(`${logPrefix} ===== end of captured build output =====`);
}

/**
 * Run `cmake.configure`, retrying while CMake Tools reports it did not run.
 *
 * Applying a Qt kit (`cmake.setKitByName`) makes CMake Tools kick off a
 * background reconfigure. When the test then invokes `cmake.configure` while
 * that is still settling, the command can be deduplicated/cancelled and resolve
 * to a *negative* exit code (typically -1) instead of the real configure
 * result. That is a readiness race, not a configuration error: a genuine CMake
 * failure returns a positive code (e.g. 1) with diagnostics.
 *
 * We therefore treat a negative (or non-numeric) rc as "not ready yet", let
 * CMake Tools settle, and try again a few times before giving up. A
 * non-negative rc is returned immediately so a real failure (rc>0) still
 * surfaces to the caller's assertion.
 *
 * NOTE: we deliberately do NOT disable `configureOnOpen`/`automaticReconfigure`
 * to avoid the race — on Linux CI that leaves CMake Tools without a bootstrapped
 * driver and `cmake.configure` then returns -1 on *every* attempt, so the retry
 * loop spins until the mocha timeout. Leaving auto-reconfigure enabled lets the
 * driver initialize; the retry only needs to ride past the transient -1.
 *
 * @returns The exit code of the configure that actually ran (0 on success).
 */
async function configureWithRetry(logPrefix: string): Promise<number> {
  const maxAttempts = 4;
  const settleDelayMs = 2000;
  let rc: number = -1;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    dlog(
      `${logPrefix} Running cmake.configure (attempt ${attempt.toString()}/${maxAttempts.toString()})...`
    );
    rc = await vscode.commands.executeCommand<number>('cmake.configure');
    await waitForVSCodeIdle();
    if (typeof rc === 'number' && rc >= 0) {
      return rc;
    }
    console.log(
      `${logPrefix} cmake.configure did not run (rc=${String(rc)}); ` +
        `CMake Tools is likely still settling. Retrying...`
    );
    await delay(settleDelayMs);
    await waitForVSCodeIdle();
  }
  return rc;
}

export async function configureAndBuildMinimalQtProject(
  ctx: { skip(): void },
  logPrefix: string,
  sandbox: sinon.SinonSandbox
): Promise<ConfigureResult> {
  const wsFolder = getWorkspaceFolderOrThrow();
  const projectDir = wsFolder.uri.fsPath;
  dlog(`${logPrefix} Using projectDir:`, projectDir);

  const buildDir = await cleanBuildDir(projectDir);

  // Diagnostic: qt-cpp registers Qt kits by running `qtpaths -query` and, on
  // failure, calls showWarningMessage("qtPaths info not found for '...'
  // Error: ...") — which never reaches stdout. Capture it so that, if no Qt
  // kit ends up registered, the CI log shows *why* (query failed vs no
  // qtpaths discovered) instead of a bare "No Qt kit available".
  const warnSpy = sandbox.spy(vscode.window, 'showWarningMessage');

  // Ensure Qt kit is available and applied
  await vscode.commands.executeCommand('qt-cpp.scanForQtKits');
  await waitForVSCodeIdle();

  const requiredQtMajor = getRequiredQtMajorFromCMake(projectDir);
  const kit = await selectAndApplyQtKit(wsFolder, requiredQtMajor);

  if (!kit) {
    const warnings = warnSpy
      .getCalls()
      .map((c) => String(c.args[0]))
      .filter((m) => /qtPaths|qtpaths|Qt/i.test(m));
    console.log(
      `${logPrefix} No Qt kit registered. Captured ${warnings.length.toString()} ` +
        `qt-cpp warning(s) during scan:`
    );
    for (const w of warnings) {
      console.log(`${logPrefix}   - ${w}`);
    }

    const message = `${logPrefix} No Qt kit available on this machine. `;
    if (process.env.CI) {
      // On CI: fail hard so we notice misconfiguration
      throw new Error(message);
    }
    // Local dev: skip this test cleanly
    ctx.skip();
    // TS: unreachable at runtime, but keeps the type checker happy
    throw new Error('Test skipped');
  }

  dlog(`${logPrefix} Selected Qt kit:`, kit);

  // Spy on error popups during configure/build
  const errSpy = sandbox.spy(vscode.window, 'showErrorMessage');

  // ---- configure + build --------------------------------------------
  const rcCfg = await configureWithRetry(logPrefix);
  expect(rcCfg, `${logPrefix} cmake.configure failed (rc=${rcCfg})`).to.equal(
    0
  );

  dlog(`${logPrefix} == WHAT CMAKE USED ==`);
  dlog(
    `${logPrefix}   Qt6_DIR =`,
    readCMakeCacheVar(buildDir, 'Qt6_DIR') ?? '<unknown>'
  );

  const rcBuild = await vscode.commands.executeCommand<number>('cmake.build');
  await waitForVSCodeIdle();
  if (rcBuild !== 0) {
    // `cmake.build` only returns an exit code; the actual compiler output goes
    // to the CMake Tools output channel and never reaches the CI log. Re-run
    // the build directly so the real error (compile/link failure) is visible.
    dumpBuildOutput(logPrefix, buildDir);
  }
  expect(rcBuild, `${logPrefix} cmake.build failed (rc=${rcBuild})`).to.equal(
    0
  );

  await delay(400); // flush to disk

  const bin = process.platform === 'win32' ? 'hello.exe' : 'hello';
  const outPath = path.join(buildDir, bin);
  dlog(`${logPrefix} Checking for binary at`, outPath);

  expect(
    fs.existsSync(outPath),
    `${logPrefix} Expected build artifact at ${outPath}`
  ).to.be.true;
  expect(errSpy.called, `${logPrefix} Unexpected error popups during build`).to
    .be.false;

  return { wsFolder, projectDir, buildDir, kit, errSpy };
}

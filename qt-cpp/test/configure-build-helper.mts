// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import { delay } from 'qt-lib';

import {
  waitForVSCodeIdle,
  getWorkspaceFolderOrThrow,
  cleanBuildDir,
  cmakeConfigForWorkspace,
  prepareCMakeQtEnvWithVersion,
  readCMakeCacheVar,
  dlog
} from './helper.mts';

// ---------------------------------------------------------------------------
// Shared helper: configure + build minimal Qt project using CMake Presets
// ---------------------------------------------------------------------------

// Test timing constants
const FS_SETTLE_DELAY_MS = 500; // Wait for file system to settle after writing files
const DISK_FLUSH_DELAY_MS = 400; // Wait for build artifacts to flush to disk
const PRESET_APPLY_TIMEOUT_MS = 30_000; // Give up waiting for CMake Tools to apply the preset
const PRESET_APPLY_RETRY_DELAY_MS = 500; // Pause between preset apply attempts

// Name of the configure preset written by `configureAndBuildMinimalQtProject`.
const CONFIGURE_PRESET_NAME = 'qt-debug';

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
 *   - `preset`    : Name of the configure preset applied for this build.
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
  preset: string;
  errSpy: sinon.SinonSpy;
};

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
 * Re-run the CMake configure directly and print its full output.
 *
 * Like `dumpBuildOutput` below, but for the configure step:
 * `vscode.commands.executeCommand('cmake.configure')` only resolves to an
 * exit code, and the actual CMake diagnostics land in the CMake Tools output
 * channel, which never reaches the CI log. Re-running `cmake --preset` puts
 * the real error (toolchain detection, find_package, ...) right before the
 * assertion failure. Best-effort only: any problem spawning cmake is logged
 * and swallowed so it never masks the original rc.
 */
function dumpConfigureOutput(
  logPrefix: string,
  projectDir: string,
  presetName: string
): void {
  console.log(
    `${logPrefix} ===== cmake.configure failed; re-running configure to capture output =====`
  );
  try {
    const res = cp.spawnSync('cmake', ['--preset', presetName], {
      cwd: projectDir,
      encoding: 'utf-8',
      shell: process.platform === 'win32'
    });
    if (res.error) {
      console.log(
        `${logPrefix} could not spawn cmake --preset: ${res.error.message}`
      );
    }
    if (res.stdout) {
      console.log(res.stdout);
    }
    if (res.stderr) {
      console.log(res.stderr);
    }
    console.log(
      `${logPrefix} cmake --preset exit code: ${res.status ?? '<none>'}`
    );
  } catch (err) {
    console.log(
      `${logPrefix} failed to capture configure output: ${(err as Error).message}`
    );
  }
  console.log(`${logPrefix} ===== end of captured configure output =====`);
}

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
 * Configure and build the minimal Qt test project using CMake Tools and
 * CMake Presets.
 *
 * This helper encapsulates the full **project bring-up phase** required
 * before any NatVis or debugger-based test can run:
 *
 *   - Resolves the workspace folder and cleans the build directory.
 *   - Resolves the Qt installation to test against (QT_TEST_QT_ROOT /
 *     qt-core.qtInstallationRoot, honoring QT_VERSION_FOR_TEST).
 *   - Writes a CMakePresets.json pinning the build directory and
 *     CMAKE_PREFIX_PATH, and applies it via `cmake.setConfigurePreset`.
 *   - Runs `cmake.configure` and `cmake.build`, asserting successful results.
 *   - Verifies that the expected build artifact exists on disk.
 *   - Spies on `vscode.window.showErrorMessage` to ensure no unexpected
 *     user-facing errors occurred during configure/build.
 *
 * We deliberately use CMake Presets instead of (generated) kits here: kit
 * generation kicks off background scans/reconfigures in CMake Tools that
 * race with the test's own `cmake.configure` call, while a preset applies
 * deterministically.
 *
 * NOTE: the test runner must seed `cmake.useCMakePresets: 'always'` in the
 * user settings so that qt-cpp classifies the project as a Presets project
 * at activation time (the project type is fixed when the extension
 * activates); `qt-cpp.natvis` resolves the Qt version through the preset.
 *
 * Test-environment behavior:
 *   - On CI: **fails hard** if no suitable Qt installation is available, so
 *     misconfiguration is immediately visible.
 *   - On local developer machines: **skips the test** cleanly if no
 *     matching Qt installation is found.
 *
 * The workspace is a temp copy created by the test runner, so the written
 * CMakePresets.json and the workspace-level CMake settings need no cleanup.
 *
 * @param ctx        Mocha test context, used only to skip the test locally
 *                   when no suitable Qt installation is available.
 * @param logPrefix  Prefix used for debug logging to keep test output readable.
 * @param sandbox    Sinon sandbox used to register spies for this test run.
 *
 * @returns An object containing workspace paths, the applied configure
 *          preset, the build directory, and the error-message spy.
 *
 * @throws Error on CI if no Qt installation is available, or if
 *         configure/build fails.
 */
export async function configureAndBuildMinimalQtProject(
  ctx: { skip(): void },
  logPrefix: string,
  sandbox: sinon.SinonSandbox
): Promise<ConfigureResult> {
  const wsFolder = getWorkspaceFolderOrThrow();
  const projectDir = wsFolder.uri.fsPath;
  dlog(`${logPrefix} Using projectDir:`, projectDir);

  const cmakeConfigurator = cmakeConfigForWorkspace(wsFolder);
  await cmakeConfigurator.set('useCMakePresets', 'always');
  await waitForVSCodeIdle();

  const buildDir = await cleanBuildDir(projectDir);

  const qtRoot = vscode.workspace
    .getConfiguration('qt-core')
    .get<string>('qtInstallationRoot');
  if (typeof qtRoot !== 'string' || qtRoot.trim() === '') {
    throw new Error('qt-core.qtInstallationRoot is not configured.');
  }

  let qtEnv;
  try {
    qtEnv = prepareCMakeQtEnvWithVersion({ topLevel: qtRoot, verbose: true });
  } catch (err) {
    const message = `${logPrefix} No suitable Qt installation found under '${qtRoot}': ${String(err)}`;
    console.warn(message);
    if (process.env.CI) {
      // On CI: fail hard so we notice misconfiguration
      throw new Error(message);
    }
    // Local dev: skip this test cleanly
    ctx.skip();
    // TS: unreachable at runtime, but keeps the type checker happy
    throw new Error('Test skipped');
  }

  const presetsPath = path.join(projectDir, 'CMakePresets.json');

  // Create a CMake Presets configuration
  //
  // On Windows the toolchain is pinned to Ninja + clang-cl instead of letting
  // CMake fall back to the default Visual Studio generator (MSVC cl). The
  // NatVis goldens are validated against clang-cl debug info: with cl, vsdbg
  // applies a silent evaluation budget to NatVis DisplayString expressions of
  // member variables, so the pointer-cast entries (QPoint, QRect, QUuid, ...)
  // come back empty even after warmUpNatvisDisplay() (see commit 0716837a).
  // The previous kit-based flow selected the clang-cl Qt kit; the preset
  // reproduces that toolchain. On other platforms the default generator is
  // kept, as before.
  //
  // clang-cl + Ninja only configure inside the VS developer environment
  // (CMake links via link.exe with libraries resolved from LIB). The kit
  // carried that environment through its `visualStudio` binding; for
  // presets, CMake Tools applies it because the test runner seeds
  // `cmake.useVsDeveloperEnvironment: 'always'`. The `architecture` field
  // uses the presets-spec "external" strategy: CMake ignores it, but CMake
  // Tools reads it to pick the environment's target architecture.
  const isWin = process.platform === 'win32';
  const presets = {
    version: 3,
    configurePresets: [
      {
        name: CONFIGURE_PRESET_NAME,
        displayName: 'Qt Debug Configuration',
        description: 'Debug build using Qt with CMake Presets',
        binaryDir: buildDir,
        ...(isWin
          ? {
              generator: 'Ninja',
              architecture: { value: 'x64', strategy: 'external' }
            }
          : {}),
        cacheVariables: {
          CMAKE_BUILD_TYPE: 'Debug',
          CMAKE_PREFIX_PATH: qtEnv.leaf,
          ...(isWin
            ? {
                CMAKE_C_COMPILER: 'clang-cl',
                CMAKE_CXX_COMPILER: 'clang-cl'
              }
            : {})
        }
      }
    ]
  };

  fs.writeFileSync(presetsPath, JSON.stringify(presets, null, 2), 'utf-8');
  dlog(
    `${logPrefix} Created CMakePresets.json with CMAKE_PREFIX_PATH:`,
    qtEnv.leaf
  );

  // Wait for file system to settle after writing CMakePresets.json
  await delay(FS_SETTLE_DELAY_MS);
  await waitForVSCodeIdle();

  // Disable automatic configuration to have precise control over test flow
  // configureOnOpen would trigger configure before we can set the preset
  // automaticReconfigure would interfere with our explicit configure call
  await cmakeConfigurator.set('configureOnOpen', false);
  await cmakeConfigurator.set('automaticReconfigure', false);

  // Spy on error popups during configure/build
  const errSpy = sandbox.spy(vscode.window, 'showErrorMessage');

  // ---- configure + build --------------------------------------------
  // `cmake.setConfigurePreset` resolves the preset name against CMake Tools'
  // in-memory presets model, which is only refreshed once its file watcher
  // has reparsed the CMakePresets.json written above. If the reload has not
  // happened yet (seen on macOS CI), the lookup fails and CMake Tools
  // silently resets the selection to null instead of applying it — and the
  // cmake.configure below then blocks forever on a preset quick pick nobody
  // can answer. Retry until the active preset reads back correctly.
  dlog(`${logPrefix} Setting configure preset: ${CONFIGURE_PRESET_NAME}`);
  const presetDeadline = Date.now() + PRESET_APPLY_TIMEOUT_MS;
  for (;;) {
    await vscode.commands.executeCommand(
      'cmake.setConfigurePreset',
      CONFIGURE_PRESET_NAME
    );
    const activePreset = await vscode.commands.executeCommand<string>(
      'cmake.activeConfigurePresetName'
    );
    if (activePreset === CONFIGURE_PRESET_NAME) {
      break;
    }
    if (Date.now() >= presetDeadline) {
      throw new Error(
        `${logPrefix} CMake Tools did not apply configure preset ` +
          `'${CONFIGURE_PRESET_NAME}' within ${PRESET_APPLY_TIMEOUT_MS}ms ` +
          `(active preset: '${activePreset}')`
      );
    }
    dlog(
      `${logPrefix} Configure preset not applied yet (active: '${activePreset}'), retrying...`
    );
    await delay(PRESET_APPLY_RETRY_DELAY_MS);
  }
  await waitForVSCodeIdle();

  dlog(`${logPrefix} Running cmake.configure...`);
  const rcCfg = await vscode.commands.executeCommand<number>('cmake.configure');
  await waitForVSCodeIdle();
  if (rcCfg !== 0) {
    // Like the build below, `cmake.configure` only returns an exit code and
    // the diagnostics stay in the CMake Tools output channel. Re-run the
    // configure directly so the real error is visible in the CI log.
    dumpConfigureOutput(logPrefix, projectDir, CONFIGURE_PRESET_NAME);
  }
  expect(rcCfg, `${logPrefix} cmake.configure failed (rc=${rcCfg})`).to.equal(
    0
  );

  dlog(`${logPrefix} == WHAT CMAKE USED ==`);
  dlog(
    `${logPrefix}   CMAKE_PREFIX_PATH =`,
    readCMakeCacheVar(buildDir, 'CMAKE_PREFIX_PATH') ?? '<unknown>'
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

  await delay(DISK_FLUSH_DELAY_MS); // flush to disk

  // Ninja (single-config) is pinned on Windows, so the binary lands directly
  // in the build directory on every platform.
  const bin = process.platform === 'win32' ? 'hello.exe' : 'hello';
  const outPath = path.join(buildDir, bin);
  dlog(`${logPrefix} Checking for binary at`, outPath);

  expect(
    fs.existsSync(outPath),
    `${logPrefix} Expected build artifact at ${outPath}`
  ).to.be.true;
  expect(errSpy.called, `${logPrefix} Unexpected error popups during build`).to
    .be.false;

  return {
    wsFolder,
    projectDir,
    buildDir,
    preset: CONFIGURE_PRESET_NAME,
    errSpy
  };
}

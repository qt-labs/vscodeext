// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

/**
 * Providers (test seam) for qtcli components.
 *
 * Why a global store?
 * Importing this module with different specifiers (e.g. "@/qtcli/providers"
 * vs "../../src/qtcli/providers.js") creates separate ESM module instances.
 * Local state would diverge between tests (.mts) and extension (.ts).
 * We keep factories on a typed slot on `globalThis` so both sides share state.
 */

import { QtcliExeFinder } from '@/qtcli/exe-finder';
import { QtcliRunner } from '@/qtcli/runner';

/** Required keys, each may be undefined (avoids exactOptionalPropertyTypes pitfalls). */
interface QtcliProvidersStore {
  finderFactory: (() => QtcliExeFinder) | undefined;
  runnerFactory: (() => QtcliRunner) | undefined;
  testModeOverride: boolean | undefined;
}

// Typed global slot (no `any`, no symbol indexing)
declare global {
  // eslint-disable-next-line no-var
  var __qtcore_qtcli_providers__: QtcliProvidersStore | undefined;
}

// Single shared store with explicit initial shape
const store: QtcliProvidersStore = (globalThis.__qtcore_qtcli_providers__ ??= {
  finderFactory: undefined,
  runnerFactory: undefined,
  testModeOverride: undefined
});

function isQtcliTestMode(): boolean {
  return store.testModeOverride === true || process.env.QT_TESTING === '1';
}

/* -------------------- Test-only setters / reset -------------------- */

export function setQtcliTestFinderFactory(
  fn: (() => QtcliExeFinder) | undefined
): void {
  store.finderFactory = fn;
}

export function setQtcliTestRunnerFactory(
  fn: (() => QtcliRunner) | undefined
): void {
  store.runnerFactory = fn;
}

export function resetQtcliProviders(): void {
  store.finderFactory = undefined;
  store.runnerFactory = undefined;
  store.testModeOverride = undefined;
}

// Optional manual toggle if env propagation ever fails
export function enableQtcliTestModeForThisProcess(): void {
  store.testModeOverride = true;
}
export function disableQtcliTestModeForThisProcess(): void {
  store.testModeOverride = false;
}

/* -------------------- Factories used by prod & tests -------------------- */

export function makeQtcliFinder(): QtcliExeFinder {
  if (isQtcliTestMode()) {
    const f = store.finderFactory; // type: (() => QtcliExeFinder) | undefined
    if (f !== undefined) {
      return f();
    }
  }
  return new QtcliExeFinder();
}

export function makeQtcliRunner(): QtcliRunner {
  if (isQtcliTestMode()) {
    const f = store.runnerFactory; // type: (() => QtcliRunner) | undefined
    if (f !== undefined) {
      return f();
    }
  }
  return new QtcliRunner();
}

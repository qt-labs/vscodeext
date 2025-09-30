// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

// This index is used exclusively for build/integration tests.
// It should not import unit tests or non-build suites, so that
// CMake Tools is only triggered when we actually want to test builds.

import * as path from 'path';
import Mocha from 'mocha';
import * as glob from 'glob';

export function run(): Promise<void> {
  const mocha = new Mocha({ ui: 'bdd', color: true });

  const testsRoot = path.resolve(__dirname);

  return new Promise((resolve, reject) => {
    // Only include the build test file that esbuild outputs
    const g = new glob.Glob('build.test.js', { cwd: testsRoot });

    g.stream()
      .on('data', (file) => mocha.addFile(path.resolve(testsRoot, file)))
      .on('error', (err) =>
        reject(err instanceof Error ? err : new Error(String(err)))
      )
      .on('end', () => {
        mocha.timeout(10000);
        mocha.run((failures) =>
          failures ? reject(new Error(`${failures} tests failed.`)) : resolve()
        );
      });
  });
}

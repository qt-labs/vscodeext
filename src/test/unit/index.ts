// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import * as Mocha from 'mocha';
import * as glob from 'glob';

export function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: 'tdd',
    color: true
  });

  const testsRoot = path.resolve(__dirname);

  return new Promise((c, e) => {
    const testFiles = new glob.Glob('**/**.test.js', { cwd: testsRoot });
    const testFileStream = testFiles.stream();

    testFileStream.on('data', (file) => {
      mocha.addFile(path.resolve(testsRoot, file));
    });
    testFileStream.on('error', (err) => {
      e(new Error(String(err)));
    });
    testFileStream.on('end', () => {
      try {
        // Run the mocha test
        mocha.timeout(10000);

        const beforeEach: Mocha.Func = function (
          this: Mocha.Context,
          done: Mocha.Done
        ) {
          console.log(
            `Starting test: ${this.currentTest?.parent?.title} - ${this.currentTest?.title}`
          );
          done();
        };
        mocha.rootHooks({ beforeEach });
        // Run the mocha test
        mocha.run((failures) => {
          if (failures > 0) {
            e(new Error(`${failures} tests failed.`));
          } else {
            c();
          }
        });
      } catch (err) {
        console.error(err);
        e(new Error(String(err)));
      }
    });
  });
}

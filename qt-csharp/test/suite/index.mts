// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import Mocha from 'mocha';
import * as glob from 'glob';

export function run(): Promise<void> {
  const mocha = new Mocha({ ui: 'bdd', color: true });
  const testsRoot = path.resolve(__dirname);
  return new Promise((resolve, reject) => {
    const testFiles = new glob.Glob('*.test.js', { cwd: testsRoot });
    const stream = testFiles.stream();
    stream.on('data', (file) => {
      mocha.addFile(path.resolve(testsRoot, file));
    });
    stream.on('error', (error) => {
      reject(new Error(error as string));
    });
    stream.on('end', () => {
      try {
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
        mocha.run((failures) => {
          if (failures > 0) {
            reject(new Error(`${failures.toString()} tests failed.`));
          } else {
            resolve();
          }
        });
      } catch (error) {
        console.error(error);
        reject(new Error(error as string));
      }
    });
  });
}

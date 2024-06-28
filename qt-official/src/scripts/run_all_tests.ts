// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import { program } from 'commander';
import { execSync } from 'child_process';

function main() {
  program.option('-p, --qt_path <string>', 'Path to Qt installation directory');
  program.parse(process.argv);
  const options = program.opts();
  const qt_path = options.qt_path as string;
  const extensionRoot = path.resolve(__dirname, '../../');
  process.chdir(extensionRoot);
  execSync('npm run unitTests', { stdio: 'inherit' });
  execSync(`npm run integrationTests -- --qt_path="${qt_path}"`, {
    stdio: 'inherit'
  });
}

main();

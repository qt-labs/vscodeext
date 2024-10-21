// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { execSync } from 'child_process';
import { program } from 'commander';

function main() {
  program.option('-d, --dir <string>', 'Path to target extension root');
  program.parse(process.argv);
  const options = program.opts();
  const targetExtensionRoot = options.dir as string;
  execSync(`eslint . --cache`, {
    cwd: targetExtensionRoot,
    stdio: 'inherit'
  });
}

main();

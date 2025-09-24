// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { execSync } from 'child_process';
// import * as path from 'path';
import { program } from 'commander';

function main() {
  program.option('-d, --dir <string>', 'Path to target extension root');
  program.parse(process.argv);
  const options = program.opts();
  const targetExtensionRoot = options.dir as string;
  const cmd = `knip -t tsconfig.json --directory ${targetExtensionRoot} --reporter symbols`;
  console.log(`Running: ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

main();

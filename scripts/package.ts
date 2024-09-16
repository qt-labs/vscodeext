// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import { execSync } from 'child_process';
import { program } from 'commander';
import * as fs from 'fs';

function main() {
  program.option('--extension <string>', 'Extension to generate package');
  program.parse(process.argv);
  const options = program.opts();
  const targetExtension = options.extension as string;
  const extensionRoot = path.resolve(__dirname, '../');
  const targetExtensionRoot = path.join(extensionRoot, targetExtension);

  execSync(`npm run package`, {
    cwd: targetExtensionRoot,
    stdio: 'inherit'
  });
  // Remove the generated `commit` file
  fs.unlinkSync(path.join(targetExtensionRoot, 'commit'));
}

main();

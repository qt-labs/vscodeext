// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs';
import { program } from 'commander';
import { execSync } from 'child_process';

function main() {
  program.option(
    '-d, --dir <string>',
    'Path to target extension output directory'
  );
  program.option('-n, --name <string>', 'Name of the extension');
  program.parse(process.argv);
  const options = program.opts();
  const targetExtensionRoot = options.dir as string;
  const extensionName = options.name as string;

  // try to find <name>-*.vsix in the output directory
  const files = fs.readdirSync(targetExtensionRoot);
  const extension = files.find(
    (file) => file.startsWith(`${extensionName}-`) && file.endsWith('.vsix')
  );
  if (!extension) {
    throw new Error(
      `Extension ${extensionName} not found in the output directory`
    );
  }

  execSync(`code --install-extension "${extension}"`, {
    cwd: targetExtensionRoot,
    stdio: 'inherit'
  });
}

main();

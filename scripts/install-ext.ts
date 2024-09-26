// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs';
import { program } from 'commander';
import { execSync } from 'child_process';
import { compare } from 'semver';

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
  const extensionFiles = files.filter(
    (file) => file.startsWith(`${extensionName}-`) && file.endsWith('.vsix')
  );
  if (extensionFiles.length === 0) {
    throw new Error(
      `No extension files found in the output directory for ${extensionName}`
    );
  }
  // Sort by version by using semver
  extensionFiles.sort((a, b) => {
    const versionA = a.split('-')[2]?.split('.vsix')[0] ?? '';
    const versionB = b.split('-')[2]?.split('.vsix')[0] ?? '';
    console.log(`Comparing ${versionA} and ${versionB}`);
    return compare(versionA, versionB);
  });
  const extension = extensionFiles[extensionFiles.length - 1];

  execSync(`code --install-extension "${extension}"`, {
    cwd: targetExtensionRoot,
    stdio: 'inherit'
  });
}

main();

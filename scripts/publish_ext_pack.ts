// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import { execSync } from 'child_process';
import { program } from 'commander';
import * as fs from 'fs';

function main() {
  program.option('--pack <string>', 'Name of the extension pack to publish');
  program.option('--dir <string>', 'Path to the extension pack root');
  program.option('--pre-release', 'Publish as pre-release');
  program.parse(process.argv);
  const options = program.opts();
  const targetExtensionPack = options.pack as string;
  const extensionRoot = path.resolve(__dirname, '../');
  const targetExtensionPackRoot = path.join(
    extensionRoot,
    options.dir as string
  );
  const preRelease = options.preRelease as boolean;
  const publishCommand = `npx vsce publish ${preRelease ? '--pre-release' : ''}`;

  execSync(`npm run checkChangelog:${targetExtensionPack}`, {
    stdio: 'inherit'
  });
  execSync(publishCommand, {
    cwd: targetExtensionPackRoot,
    stdio: 'inherit'
  });
  // Remove the generated `commit` file
  fs.unlinkSync(path.join(targetExtensionPackRoot, 'commit'));
}

main();

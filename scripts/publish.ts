// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import { execSync } from 'child_process';
import { program } from 'commander';

function main() {
  program.option('-ext, --extension <string>', 'Path to target extension root');
  program.option('--pre-release', 'Publish as pre-release');
  program.parse(process.argv);
  const options = program.opts();
  const targetExtension = options.extension as string;
  const extensionRoot = path.resolve(__dirname, '../');
  const targetExtensionRoot = path.join(extensionRoot, targetExtension);
  const preRelease = options.preRelease as boolean;
  const publishCommand = `npx vsce publish ${preRelease ? '--pre-release' : ''}`;

  execSync(`npm run _prepublish`, { stdio: 'inherit' });
  execSync(`npm run ci:${targetExtension}`, { stdio: 'inherit' });
  execSync(`npm run compile:${targetExtension}`, { stdio: 'inherit' });
  execSync(`npm run ci-lint:${targetExtension}`, { stdio: 'inherit' });
  execSync(publishCommand, {
    cwd: targetExtensionRoot,
    stdio: 'inherit'
  });
}

main();

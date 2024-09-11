// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import { execSync } from 'child_process';
import { program } from 'commander';
import * as fs from 'fs';

import * as common from './common';

function main() {
  common.checkForUncommittedChanges();
  program.option('-ext, --extension <string>', 'Path to target extension root');
  program.option('--pre-release', 'Publish as pre-release');
  program.option('--git-remote <string>', 'Git remote to push to');
  program.parse(process.argv);
  const options = program.opts();
  const targetExtension = options.extension as string;
  const extensionRoot = path.resolve(__dirname, '../');
  const targetExtensionRoot = path.join(extensionRoot, targetExtension);
  const preRelease = options.preRelease as boolean;
  const remote = (options.gitRemote as string)
    ? (options.gitRemote as string)
    : 'origin';
  const publishCommand = `npx vsce publish ${preRelease ? '--pre-release' : ''}`;
  const version = common.getExtensionVersion(targetExtensionRoot);

  common.checkForTagCommit(targetExtension, version);

  execSync(`npm run _prepublish`, { stdio: 'inherit' });
  execSync(`npm run ci:${targetExtension}`, { stdio: 'inherit' });
  execSync(`npm run compile:${targetExtension}`, { stdio: 'inherit' });
  execSync(`npm run ci-lint:${targetExtension}`, { stdio: 'inherit' });
  execSync(publishCommand, {
    cwd: targetExtensionRoot,
    stdio: 'inherit'
  });
  // Remove the generated `commit` file
  fs.unlinkSync(path.join(targetExtension, 'commit'));

  common.pushTag(extensionRoot, targetExtension, version, remote);

  console.log(
    `Successfully published ${targetExtension} extension with version ${version}`
  );
}

main();

// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import { execSync } from 'child_process';
import { program } from 'commander';
import * as fs from 'fs';

import * as common from './common';

function main() {
  common.checkForUncommittedChanges();
  program.option('--pack <string>', 'Name of the extension pack to publish');
  program.option('--dir <string>', 'Path to the extension pack root');
  program.option('--pre-release', 'Publish as pre-release');
  program.option('--git-remote <string>', 'Git remote to push to');
  program.parse(process.argv);
  const options = program.opts();
  const targetExtensionPack = options.pack as string;
  const remote = (options.gitRemote as string)
    ? (options.gitRemote as string)
    : 'origin';
  const extensionRoot = path.resolve(__dirname, '../');
  const targetExtensionPackRoot = path.join(
    extensionRoot,
    options.dir as string
  );
  const preRelease = options.preRelease as boolean;
  const publishCommand = `npx vsce publish ${preRelease ? '--pre-release' : ''}`;
  const version = common.getExtensionVersion(targetExtensionPackRoot);

  common.checkForTagCommit(targetExtensionPack, version);

  execSync(`npm run _prepublish_git`, { stdio: 'inherit' });
  execSync(`npm ci`, { stdio: 'inherit' });
  execSync(`npm run checkChangelog:${targetExtensionPack}`, {
    stdio: 'inherit'
  });
  execSync(publishCommand, {
    cwd: targetExtensionPackRoot,
    stdio: 'inherit'
  });
  // Remove the generated `commit` file
  fs.unlinkSync(path.join(targetExtensionPackRoot, 'commit'));

  common.pushTag(targetExtensionPackRoot, targetExtensionPack, version, remote);

  console.log(
    `Successfully published ${targetExtensionPack} extension pack with version ${version}`
  );
}

main();

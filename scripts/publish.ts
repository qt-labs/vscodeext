// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import { execSync } from 'child_process';
import { program } from 'commander';
import * as fs from 'fs';
import * as semver from 'semver';

import * as common from './common';

function extractAndPlaceQtCli(qtcorePath: string, zipPath: string) {
  try {
    const outputDir = path.join(qtcorePath, 'res', 'qtcli');
    // Remove outputDir if it exists to clean up the previous extraction
    if (fs.existsSync(outputDir)) {
      console.log(`Removing existing ${outputDir}`);
      fs.rmSync(outputDir, { recursive: true });
    }
    console.log(`Creating "${outputDir}"`);
    fs.mkdirSync(outputDir, { recursive: true });
    // Unzipper removes permissions from the files, so use local tools like `unzip`
    // https://github.com/ZJONSSON/node-unzipper/issues/216
    console.log(`Extracting "${zipPath}" to "${outputDir}"`);
    execSync(`unzip -o ${zipPath} -d ${outputDir}`, { stdio: 'inherit' });
    // chmod 755 to all files in the outputDir
    console.log(`Setting permissions for files in "${outputDir}"`);
    const setPermissions = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          setPermissions(fullPath);
        } else {
          fs.chmodSync(fullPath, 0o755);
        }
      }
    };
    setPermissions(outputDir);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

function main() {
  common.checkForUncommittedChanges();
  program.option('-ext, --extension <string>', 'Path to target extension root');
  program.option('--pre-release', 'Publish as pre-release');
  program.option('--git-remote <string>', 'Git remote to push to');
  program.option('--qt-cli <string>', 'Signed qt-cli.zip path');
  program.parse(process.argv);
  const options = program.opts();
  const targetExtension = options.extension as string;
  const extensionRoot = path.resolve(__dirname, '../');
  const targetExtensionRoot = path.join(extensionRoot, targetExtension);
  const qtcliZipPath = options.qtCli as string;
  const preRelease = options.preRelease as boolean;
  const remote = (options.gitRemote as string)
    ? (options.gitRemote as string)
    : 'origin';
  const publishCommand = `npx vsce publish ${preRelease ? '--pre-release' : ''}`;
  const version = common.getExtensionVersion(targetExtensionRoot);
  const isQtcore = targetExtension.includes('qt-core');
  if (isQtcore && !qtcliZipPath) {
    throw new Error('qt-cli.zip path must be provided for qt-core extension');
  }
  const isQtcpp = targetExtension.includes('qt-cpp');
  const isEven = (num: number) => num % 2 === 0;
  const parsedVersion = semver.parse(version);
  if (parsedVersion === null) {
    throw new Error(`Invalid version: ${version}`);
  }
  if (isEven(parsedVersion.minor) && preRelease) {
    throw new Error(
      `Cannot publish pre-release version for even minor version: ${version}`
    );
  }
  if (!isEven(parsedVersion.minor) && !preRelease) {
    throw new Error(
      `Cannot publish stable version for odd minor version: ${version}`
    );
  }

  execSync(`npm run _prepublish`, { stdio: 'inherit' });
  if (isQtcpp) {
    execSync(`npm run prepareNatvisFiles`, { stdio: 'inherit' });
  }
  execSync(`npm run ci:${targetExtension}`, { stdio: 'inherit' });
  execSync(`npm run compile:${targetExtension}`, { stdio: 'inherit' });
  execSync(`npm run ci-lint:${targetExtension}`, { stdio: 'inherit' });
  execSync(`npm run checkChangelog -- --dir="${targetExtensionRoot}"`, {
    cwd: extensionRoot,
    stdio: 'inherit'
  });
  if (isQtcore) {
    extractAndPlaceQtCli(targetExtensionRoot, qtcliZipPath);
  }
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

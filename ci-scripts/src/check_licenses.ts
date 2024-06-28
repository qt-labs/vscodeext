// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import * as fs from 'fs';
import { program } from 'commander';
import { execSync } from 'child_process';

function main() {
  program.option('-d, --dir <string>', 'Path to target extension root');
  program.option('-e, --exclude <string>', 'Exclude packages');
  program.parse(process.argv);
  const options = program.opts();
  const extensionRoot = path.resolve(__dirname, '../');
  const targetExtensionRoot = options.dir as string;
  const exclude = options.exclude as string;
  const temp = path.join(targetExtensionRoot, 'ThirdPartyNotices_temp.txt');
  let isCatchedError = false;
  try {
    console.log('Checking licenses...');
    const previousFile = path.join(
      targetExtensionRoot,
      'ThirdPartyNotices.txt'
    );
    if (!fs.existsSync(previousFile)) {
      throw new Error(`${previousFile} file not found`);
    }
    process.chdir(targetExtensionRoot);
    console.log('temp file:', temp);
    execSync(
      `npm run generateLicenses -- --output="${temp}" --dir="${targetExtensionRoot}" --exclude="${exclude}"`,
      {
        cwd: extensionRoot,
        stdio: 'inherit'
      }
    );

    const tempText = fs.readFileSync(temp, 'utf-8');
    const previousText = fs.readFileSync(previousFile, 'utf-8');
    if (tempText === previousText) {
      console.log('ThirdPartyNotices.txt is up to date.');
    } else {
      const errorMessage =
        `ThirdPartyNotices.txt is out of date.` +
        `Please run 'npm run generateLicenses' to update it.`;
      throw new Error(errorMessage);
    }
  } catch (error) {
    console.error(error);
    isCatchedError = true;
  } finally {
    fs.rmSync(temp, { force: true });
    if (isCatchedError) {
      process.exit(1);
    }
  }
}

main();

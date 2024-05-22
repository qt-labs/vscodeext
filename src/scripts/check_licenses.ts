// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

function main() {
  const extensionRoot = path.resolve(__dirname, '../../');
  const temp = path.join(extensionRoot, 'ThirdPartyNotices_temp.txt');
  let isCatchedError = false;
  try {
    console.log('Checking licenses...');
    const previousFile = path.join(extensionRoot, 'ThirdPartyNotices.txt');
    if (!fs.existsSync(previousFile)) {
      throw new Error(`${previousFile} file not found`);
    }
    process.chdir(extensionRoot);
    console.log('temp file:', temp);
    execSync(`npm run generateLicenses -- --output="${temp}"`, {
      stdio: 'inherit'
    });

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

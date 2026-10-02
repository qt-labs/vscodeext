// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import * as fs from 'fs';
import { program } from 'commander';
import { execSync } from 'child_process';

function main() {
  program.option('-d, --dir <string>', 'Path to target extension root');
  program.parse(process.argv);
  const options = program.opts();
  const extensionRoot = path.resolve(__dirname, '../');
  // --dir is relative to the repository root, or absolute.
  const targetExtensionRoot = path.resolve(
    extensionRoot,
    options.dir as string
  );
  const temp = path.join(targetExtensionRoot, 'sbom_temp.cdx.json');
  let isCatchedError = false;
  try {
    console.log('Checking SBOM...');
    const previousFile = path.join(targetExtensionRoot, 'sbom.cdx.json');
    if (!fs.existsSync(previousFile)) {
      throw new Error(`${previousFile} file not found`);
    }
    console.log('temp file:', temp);
    execSync(
      `npm run generateSbom -- --output="${temp}" --dir="${targetExtensionRoot}"`,
      {
        cwd: extensionRoot,
        stdio: 'inherit'
      }
    );
    const tempText = fs.readFileSync(temp, 'utf-8');
    const previousText = fs.readFileSync(previousFile, 'utf-8');
    if (tempText === previousText) {
      console.log('sbom.cdx.json is up to date.');
    } else {
      const errorMessage =
        `sbom.cdx.json is out of date.` +
        `Please run 'npm run generateSbom:all' to update it.`;
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

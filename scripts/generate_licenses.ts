// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import * as fs from 'fs';
import { program } from 'commander';
import { execSync } from 'child_process';

type Licenses = Record<string, License>;

interface License {
  licenses: string;
  repository: string;
  publisher: string;
  email: string;
  url: string;
  path: string;
  licenseFile: string;
}

async function main() {
  program.option('-o, --output <string>', 'Path to output file');
  program.option('-d, --dir <string>', 'Path to target extension root');
  program.option('-e, --exclude <string>', 'Exclude packages');
  program.parse(process.argv);
  const options = program.opts();
  const outputFile = options.output as string;
  const exclude = options.exclude as string;

  console.log('Generating third-party licenses...');
  const targetExtensionRoot = options.dir as string;
  const output = execSync('npx license-checker --production --json', {
    cwd: targetExtensionRoot,
    encoding: 'utf-8'
  });

  const outputJSON = JSON.parse(output) as Licenses;
  const thirdPartyLicensesFile =
    outputFile && outputFile !== ''
      ? outputFile
      : path.resolve(targetExtensionRoot, 'ThirdPartyNotices.txt');
  fs.rmSync(thirdPartyLicensesFile, { force: true });
  const append = (str: string) => {
    fs.appendFileSync(thirdPartyLicensesFile, str);
  };
  const appendLicense = (license: string) => {
    license.replace(/\r\n/g, '\n');
    const lines = license.split('\n').map((line) => line.trimEnd());
    append(lines.join('\n'));
  };
  const initialText = `Third-Party Notices\n\nThis file contains the licenses for third-party software used in this product.\n`;
  append(initialText);
  const entries = Object.entries(outputJSON);
  console.log(`Found ${entries.length} third-party dependencies`);
  for (const [name, license] of entries.sort()) {
    if (name.includes(exclude)) {
      continue;
    }
    append('\n');
    append('---------------------------------------------------------\n\n');
    const version = name.split('@').pop();
    const nameWithoutVersion = name.replace(`@${version}`, '');
    const nameWithoutVersionAndPublisher = nameWithoutVersion.split('/').pop();

    append(
      `${nameWithoutVersionAndPublisher} ${version} - ${license.licenses}\n`
    );
    append(`${license.repository}#readme\n\n`);
    const licenseFilePath = path.resolve(
      targetExtensionRoot,
      license.licenseFile
    );
    const licenseFileName = path.basename(licenseFilePath);
    if (licenseFileName.toLowerCase() !== 'license') {
      const possibleLicenseFileNames = [
        'license',
        'license.md',
        'license.txt',
        'LICENSE',
        'LICENSE.md',
        'LICENSE.txt',
        'License.txt'
      ];
      const repo = license.repository.replace(
        'github.com',
        'raw.githubusercontent.com'
      );
      const possibleBranches = ['main', 'master'];
      let found = false;
      for (const possibleLicenseFileName of possibleLicenseFileNames) {
        for (const possibleBranch of possibleBranches) {
          const response = await fetch(
            `${repo}/${possibleBranch}/${possibleLicenseFileName}`
          );
          if (response.ok) {
            const licenseFile = await response.text();
            appendLicense(licenseFile);
            found = true;
            break;
          }
        }
      }
      if (!found) {
        throw new Error(`Could not find license file for ${name}`);
      }
    } else {
      const licenseFile = fs.readFileSync(licenseFilePath, 'utf-8');
      appendLicense(licenseFile);
    }
    append('\n---------------------------------------------------------\n');
  }
  console.log('Third-party licenses generated successfully');
}

void main();

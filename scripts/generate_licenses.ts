// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import * as fs from 'fs';
import { program } from 'commander';
import { execSync } from 'child_process';
import { EOL } from 'os';

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
  const excludeList = exclude.split(',').map((excluded) => excluded.trim());

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
    const normalizedLicense = license.replace(/\r?\n/g, EOL);
    const lines = normalizedLicense.split(EOL).map((line) => line.trimEnd());
    append(lines.join(EOL));
  };
  const initialText = `Third-Party Notices${EOL}${EOL}This file contains the licenses for third-party software used in this product.${EOL}`;
  append(initialText);
  const entries = Object.entries(outputJSON);
  console.log(`Found ${entries.length} third-party dependencies`);
  for (const [name, license] of entries.sort()) {
    if (excludeList.some((excluded) => name.includes(excluded))) {
      continue;
    }
    append(EOL);
    append(
      `---------------------------------------------------------${EOL}${EOL}`
    );
    const version = name.split('@').pop();
    const nameWithoutVersion = name.replace(`@${version}`, '');
    const nameWithoutVersionAndPublisher = nameWithoutVersion.split('/').pop();

    append(
      `${nameWithoutVersionAndPublisher} ${version} - ${license.licenses}${EOL}`
    );
    append(`${license.repository}#readme${EOL}${EOL}`);

    if (
      !license.licenseFile ||
      !license.licenseFile.toLocaleLowerCase().includes('license')
    ) {
      const possibleLicenseFileNames = [
        'license',
        'license.md',
        'license.txt',
        'LICENSE',
        'LICENSE.md',
        'LICENSE.txt',
        'License.txt',
        'LICENSE.TXT',
        'MIT-LICENSE.txt'
      ];
      const repo = license.repository.replace(
        'github.com',
        'raw.githubusercontent.com'
      );
      const possibleBranches = ['main', 'master'];
      let found = false;
      for (const possibleLicenseFileName of possibleLicenseFileNames) {
        for (const possibleBranch of possibleBranches) {
          try {
            const response = await fetch(
              `${repo}/${possibleBranch}/${possibleLicenseFileName}`
            );
            if (response.ok) {
              const licenseFile = await response.text();
              appendLicense(licenseFile);
              found = true;
              break;
            }
          } catch (error) {
            // Ignore errors, continue to next possible file or branch
          }
        }
      }
      if (!found) {
        if (license.licenses === 'MIT') {
          appendLicense(MIT_LICENSE);
        } else {
          throw new Error(`Cannot find license file for ${name} in ${repo}`);
        }
      }
    } else {
      const licenseFile = fs.readFileSync(license.licenseFile, 'utf-8');
      appendLicense(licenseFile);
    }
    append(
      `${EOL}---------------------------------------------------------${EOL}`
    );
  }
  console.log('Third-party licenses generated successfully');
}

void main();

const MIT_LICENSE = `This software is released under the MIT license:

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
`;

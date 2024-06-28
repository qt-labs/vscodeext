// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import { execSync } from 'child_process';
import { program } from 'commander';

function main() {
  program.option('-d, --dir <string>', 'Path to target extension root');
  program.option('-e, --exclude_licenses <string>', 'Exclude packages');
  program.parse(process.argv);
  const options = program.opts();
  const targetExtensionRoot = options.dir as string;
  const extensionRoot = path.resolve(__dirname, '../');
  const excludeLicense = options.exclude_licenses as string;
  execSync(`npm run checkStyle -- --dir="${targetExtensionRoot}"`, {
    cwd: extensionRoot,
    stdio: 'inherit'
  });
  execSync(`eslint .`, {
    cwd: targetExtensionRoot,
    stdio: 'inherit'
  });
  execSync(
    `npm run checkLicenses -- --dir="${targetExtensionRoot}" --exclude="${excludeLicense}"`,
    {
      cwd: extensionRoot,
      stdio: 'inherit'
    }
  );
  execSync(`npm run checkPackage -- --dir="${targetExtensionRoot}"`, {
    cwd: extensionRoot,
    stdio: 'inherit'
  });
}

main();

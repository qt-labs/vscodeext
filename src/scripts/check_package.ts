// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

interface PackageJson {
  name: string;
  version: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

interface RootPackage {
  version: string;
}

interface PackageLockJson {
  name: string;
  version: string;
  packages: {
    '': RootPackage;
  };
}

function main() {
  const extensionRoot = path.resolve(__dirname, '../../');
  const packageJsonPath = path.join(extensionRoot, 'package.json');
  const packageLockJsonPath = path.join(extensionRoot, 'package-lock.json');
  const packageJson = JSON.parse(
    fs.readFileSync(packageJsonPath, 'utf-8')
  ) as PackageJson;
  const packageLockJson = JSON.parse(
    fs.readFileSync(packageLockJsonPath, 'utf-8')
  ) as PackageLockJson;
  process.chdir(extensionRoot);
  console.log('Checking package versions...');
  if (
    packageJson.version !== packageLockJson.version ||
    packageJson.version !== packageLockJson.packages[''].version
  ) {
    const errorMessage =
      'Package versions do not match. Please run `npm install` to update package-lock.json';
    console.error(errorMessage);
    process.exit(1);
  }
  console.log('Package versions match');

  console.log('Checking for missing dependencies...');
  try {
    execSync('npm ls');
  } catch (error) {
    const errorMessage =
      "Missing dependencies found. Please run 'npm install' to install missing dependencies.";
    console.error(errorMessage);
    process.exit(1);
  }
  console.log('All dependencies are installed');
}

main();

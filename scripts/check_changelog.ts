// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import * as fs from 'fs';
import { program } from 'commander';

interface RootPackage {
  version: string;
}

function main() {
  program.option('-d, --dir <string>', 'Path to target extension root');
  program.parse(process.argv);
  const options = program.opts();
  const targetExtensionRoot = options.dir as string;
  const packageJsonPath = path.join(targetExtensionRoot, 'package.json');
  const packageJson = JSON.parse(
    fs.readFileSync(packageJsonPath, 'utf-8')
  ) as RootPackage;
  const version = '## ' + packageJson.version;
  const changeLogPath = path.join(targetExtensionRoot, 'CHANGELOG.md');
  const changeLog = fs.readFileSync(changeLogPath, 'utf-8');
  if (!changeLog.includes(version)) {
    console.error(
      `The version ${version} is missing in ${path.join(targetExtensionRoot, `CHANGELOG.md`)}`
    );
    process.exit(1);
  }
  console.log(
    `The version ${version} found in ${path.join(targetExtensionRoot, `CHANGELOG.md`)}`
  );
}

main();
